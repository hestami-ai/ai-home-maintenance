import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export interface DimensionOptions {
	color?: number;
	lineWidth?: number;
	textColor?: string;
	textSize?: string;
	unit?: 'meters' | 'feet';
	showArrows?: boolean;
	offset?: number;
	debug?: boolean;
	filters?: {
		showWalls?: boolean;
		showFloors?: boolean;
		showWindows?: boolean;
		showDoors?: boolean;
		showFurniture?: boolean;
		showOpenings?: boolean;
	};
}

export class DimensionHelper {
	private scene: THREE.Scene;
	private dimensionGroup: THREE.Group;
	private options: Required<DimensionOptions>;
	private modelScale: number = 1.0;
	private modelGroup?: THREE.Object3D;

	constructor(scene: THREE.Scene, options: DimensionOptions = {}) {
		this.scene = scene;
		this.dimensionGroup = new THREE.Group();
		this.dimensionGroup.name = 'dimensions';
		this.scene.add(this.dimensionGroup);

		this.options = {
			color: options.color ?? 0x0066ff,
			lineWidth: options.lineWidth ?? 2,
			textColor: options.textColor ?? '#0066ff',
			textSize: options.textSize ?? '14px',
			unit: options.unit ?? 'feet',
			showArrows: options.showArrows ?? true,
			offset: options.offset ?? 0.1,
			debug: options.debug ?? false,
			filters: {
				showWalls: options.filters?.showWalls ?? true,
				showFloors: options.filters?.showFloors ?? true,
				showWindows: options.filters?.showWindows ?? true,
				showDoors: options.filters?.showDoors ?? true,
				showFurniture: options.filters?.showFurniture ?? false,
				showOpenings: options.filters?.showOpenings ?? true
			}
		};
		
		if (this.options.debug) {
			console.log('[DimensionHelper] Initialized with options:', this.options);
		}
	}

	/**
	 * Add a dimension line between two points
	 */
	addDimension(
		start: THREE.Vector3,
		end: THREE.Vector3,
		label?: string,
		offset: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
	): void {
		// Calculate distance in scaled viewport units
		const scaledDistance = start.distanceTo(end);
		
		// Convert back to real-world units for display (divide by model scale)
		const realDistance = scaledDistance / this.modelScale;
		const displayDistance = this.formatDistance(realDistance);
		const displayLabel = label ? `${label}: ${displayDistance}` : displayDistance;

		// Positions are already in scaled world space from matrixWorld
		// Just apply the offset (which is also in scaled space)
		const offsetStart = start.clone().add(offset);
		const offsetEnd = end.clone().add(offset);

		// Create the main line
		const points = [offsetStart, offsetEnd];
		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const material = new THREE.LineBasicMaterial({
			color: this.options.color,
			linewidth: this.options.lineWidth
		});
		const line = new THREE.Line(geometry, material);
		this.dimensionGroup.add(line);

		// Add arrows at endpoints if enabled
		if (this.options.showArrows) {
			this.addArrow(offsetStart, offsetEnd, this.options.color);
			this.addArrow(offsetEnd, offsetStart, this.options.color);
		}

		// Add text label at midpoint
		const midpoint = new THREE.Vector3()
			.addVectors(offsetStart, offsetEnd)
			.multiplyScalar(0.5);
		this.addLabel(midpoint, displayLabel);
	}

	/**
	 * Add dimension lines for a bounding box
	 */
	addBoundingBoxDimensions(box: THREE.Box3, name?: string): void {
		const size = new THREE.Vector3();
		box.getSize(size);

		const min = box.min;
		const max = box.max;

		// Offset for dimension lines (outside the box)
		const offset = this.options.offset;

		// Bottom edges (floor level)
		// Length (X-axis) - front edge
		this.addDimension(
			new THREE.Vector3(min.x, min.y, max.z),
			new THREE.Vector3(max.x, min.y, max.z),
			undefined,
			new THREE.Vector3(0, -offset, offset)
		);

		// Width (Z-axis) - right edge
		this.addDimension(
			new THREE.Vector3(max.x, min.y, min.z),
			new THREE.Vector3(max.x, min.y, max.z),
			undefined,
			new THREE.Vector3(offset, -offset, 0)
		);

		// Height (Y-axis) - front-right corner
		this.addDimension(
			new THREE.Vector3(max.x, min.y, max.z),
			new THREE.Vector3(max.x, max.y, max.z),
			undefined,
			new THREE.Vector3(offset, 0, offset)
		);

		// Add area label if name provided
		if (name) {
			const area = size.x * size.z;
			const areaLabel = `${name}\nArea: ${this.formatArea(area)}`;
			const center = new THREE.Vector3();
			box.getCenter(center);
			center.y = min.y - offset * 2;
			this.addLabel(center, areaLabel);
		}
	}

	/**
	 * Add dimensions for all meshes in a group
	 */
	addMeshDimensions(object: THREE.Object3D, nameFilter?: string[]): void {
		object.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				// Filter by name if provided
				if (nameFilter && !nameFilter.some(filter => child.name.includes(filter))) {
					return;
				}

				// Compute bounding box
				const geometry = child.geometry;
				if (!geometry.boundingBox) {
					geometry.computeBoundingBox();
				}

				if (geometry.boundingBox) {
					const box = geometry.boundingBox.clone();
					box.applyMatrix4(child.matrixWorld);
					
					// Only add dimensions for significant objects (not tiny details)
					const size = new THREE.Vector3();
					box.getSize(size);
					if (size.length() > 0.1) {
						this.addBoundingBoxDimensions(box, child.name);
					}
				}
			}
		});
	}

	/**
	 * Get oriented bounding box corners for a mesh
	 */
	private getOrientedBoundingBox(mesh: THREE.Mesh): {
		corners: THREE.Vector3[];
		center: THREE.Vector3;
		size: THREE.Vector3;
		localSize: THREE.Vector3;
	} {
		// Ensure world matrix is up to date
		mesh.updateMatrixWorld(true);
		
		const geometry = mesh.geometry;
		if (!geometry.boundingBox) {
			geometry.computeBoundingBox();
		}
		
		const bbox = geometry.boundingBox!;
		const localSize = new THREE.Vector3();
		bbox.getSize(localSize);
		
		// Get 8 corners of the local bounding box
		const localCorners = [
			new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
			new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
			new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
			new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
			new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
			new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
			new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z),
			new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
		];
		
		// Transform corners to world space using full matrixWorld
		// This includes parent transforms (position, rotation, AND scale)
		const worldCorners = localCorners.map(corner => 
			corner.clone().applyMatrix4(mesh.matrixWorld)
		);
		
		// Calculate world-space center
		const center = new THREE.Vector3();
		worldCorners.forEach(corner => center.add(corner));
		center.divideScalar(8);
		
		// Calculate world-space size (distance between opposite corners)
		const size = new THREE.Vector3(
			worldCorners[1].distanceTo(worldCorners[0]), // X dimension
			worldCorners[4].distanceTo(worldCorners[0]), // Y dimension  
			worldCorners[3].distanceTo(worldCorners[0])  // Z dimension
		);
		
		if (this.options.debug) {
			console.log(`[DimensionHelper] OBB for "${mesh.name}":`, {
				localSize: localSize.toArray(),
				worldSize: size.toArray(),
				localCorner0: localCorners[0].toArray(),
				worldCorner0: worldCorners[0].toArray(),
				worldCorner1: worldCorners[1].toArray(),
				edge01Distance: worldCorners[0].distanceTo(worldCorners[1]),
				matrixWorldScale: new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).toArray()
			});
		}
		
		return { corners: worldCorners, center, size, localSize };
	}

	/**
	 * Add dimensions for room boundaries (walls and floor)
	 */
	addRoomDimensions(object: THREE.Object3D): void {
		if (this.options.debug) {
			console.log('[DimensionHelper] addRoomDimensions called for object:', object.name);
		}
		
		// Collect all meshes with their oriented bounding boxes
		type OBBType = {
			corners: THREE.Vector3[];
			center: THREE.Vector3;
			size: THREE.Vector3;
			localSize: THREE.Vector3;
		};
		const meshData: Array<{ 
			name: string; 
			mesh: THREE.Mesh;
			obb: OBBType;
		}> = [];

		object.traverse((child) => {
			// Skip dimension helper objects
			if (child === this.dimensionGroup || child.parent === this.dimensionGroup) {
				return;
			}
			
			if (child instanceof THREE.Mesh) {
				// Use parent name if mesh name is empty (common for multi-reference groups)
				let name = child.name;
				if (!name && child.parent) {
					name = child.parent.name;
				}
				
				const obb = this.getOrientedBoundingBox(child);
				meshData.push({ name, mesh: child, obb });
				
				if (this.options.debug) {
					console.log(`[DimensionHelper] Found mesh: "${name}" (original: "${child.name}")`, {
						position: child.position.toArray(),
						rotation: child.rotation.toArray(),
						scale: child.scale.toArray(),
						localSize: obb.localSize.toArray(),
						worldSize: obb.size.toArray(),
						center: obb.center.toArray(),
						parentName: child.parent?.name
					});
				}
			}
		});

		if (this.options.debug) {
			console.log(`[DimensionHelper] Total meshes found: ${meshData.length}`);
		}

		// Process each mesh and add appropriate dimensions
		for (const { name, mesh, obb } of meshData) {
			const { corners, center, size, localSize } = obb;
			const nameLower = name.toLowerCase();
			
			// Determine object type by size and name
			// Windows are typically smaller than walls (< 2.5m in any dimension)
			const maxDim = Math.max(localSize.x, localSize.y, localSize.z);
			const isSmallObject = maxDim < 2.5;

			// Determine what type of element this is
			if (nameLower.includes('floor')) {
				if (this.options.debug) {
					console.log(`[DimensionHelper] Processing FLOOR: "${name}"`, {
						enabled: this.options.filters.showFloors,
						size: size.toArray(),
						center: center.toArray(),
						localSize: localSize.toArray(),
						corner0: corners[0].toArray(),
						corner1: corners[1].toArray(),
						corner2: corners[2].toArray(),
						edge01Distance: corners[0].distanceTo(corners[1]),
						edge12Distance: corners[1].distanceTo(corners[2])
					});
				}
				
				if (!this.options.filters.showFloors) return;
				
				// Floor: show length and width using oriented corners
				// Bottom corners: 0,1,2,3
				const floorOffset = this.options.offset;
				
				// Calculate perpendicular directions for better offset placement
				const edge01 = new THREE.Vector3().subVectors(corners[1], corners[0]);
				const edge12 = new THREE.Vector3().subVectors(corners[2], corners[1]);
				
				// Length dimension (along edge 0-1), offset perpendicular to the edge
				const lengthPerpendicular = new THREE.Vector3().crossVectors(edge01, new THREE.Vector3(0, 1, 0)).normalize();
				this.addDimension(
					corners[0],
					corners[1],
					'Floor Length',
					lengthPerpendicular.multiplyScalar(floorOffset * 5).add(new THREE.Vector3(0, -floorOffset, 0))
				);
				
				// Width dimension (along edge 1-2), offset perpendicular to the edge
				const widthPerpendicular = new THREE.Vector3().crossVectors(edge12, new THREE.Vector3(0, 1, 0)).normalize();
				this.addDimension(
					corners[1],
					corners[2],
					'Floor Width',
					widthPerpendicular.multiplyScalar(floorOffset * 5).add(new THREE.Vector3(0, -floorOffset, 0))
				);
			} else if (nameLower.includes('wall') && !isSmallObject) {
				// Only process as wall if it's large enough (not a window/door)
				const edge01Length = corners[0].distanceTo(corners[1]);
				const edge03Length = corners[0].distanceTo(corners[3]);
				const heightLength = corners[0].distanceTo(corners[4]);
				
				if (this.options.debug) {
					console.log(`[DimensionHelper] Processing WALL: "${name}"`, {
						enabled: this.options.filters.showWalls,
						size: size.toArray(),
						center: center.toArray(),
						localSize: localSize.toArray(),
						corner0: corners[0].toArray(),
						corner1: corners[1].toArray(),
						corner3: corners[3].toArray(),
						corner4: corners[4].toArray(),
						edge01Length,
						edge03Length,
						heightLength,
						longerEdge: edge01Length > edge03Length ? '0-1' : '0-3'
					});
				}
				
				if (!this.options.filters.showWalls) return;
				
				// Wall: show height and length using oriented corners
				const offset = this.options.offset;
				
				// Height: from bottom corner to top corner (vertical edge)
				// Use corner 0 (bottom) to corner 4 (top, same XZ position)
				const heightStart = corners[0].clone();
				const heightEnd = corners[4].clone();
				
				// Calculate offset perpendicular to wall length (outward from room)
				// Wall length direction
				const wallLengthDir = edge01Length > edge03Length ? 
					new THREE.Vector3().subVectors(corners[1], corners[0]).normalize() :
					new THREE.Vector3().subVectors(corners[3], corners[0]).normalize();
				
				// Cross with up vector to get outward direction
				const upVector = new THREE.Vector3(0, 1, 0);
				const outwardDir = new THREE.Vector3().crossVectors(wallLengthDir, upVector).normalize();
				
				// Place height dimension outside the room
				const heightOffset = outwardDir.multiplyScalar(offset * 6);
				
				this.addDimension(heightStart, heightEnd, 'Wall Height', heightOffset);
				
				// Length: along the longer bottom edge (already calculated above)
				let lengthStart, lengthEnd, lengthDirection;
				if (edge01Length > edge03Length) {
					// Edge 0-1 is longer
					lengthStart = corners[0].clone();
					lengthEnd = corners[1].clone();
					lengthDirection = new THREE.Vector3().subVectors(corners[1], corners[0]).normalize();
				} else {
					// Edge 0-3 is longer
					lengthStart = corners[0].clone();
					lengthEnd = corners[3].clone();
					lengthDirection = new THREE.Vector3().subVectors(corners[3], corners[0]).normalize();
				}
				
				// Offset downward and slightly outward for length dimension
				const lengthOffset = new THREE.Vector3(0, -offset * 3, 0);
				
				if (this.options.debug) {
					console.log(`[DimensionHelper] Adding wall length:`, {
						start: lengthStart.toArray(),
						end: lengthEnd.toArray(),
						offset: lengthOffset.toArray(),
						distance: lengthStart.distanceTo(lengthEnd)
					});
				}
				
				this.addDimension(lengthStart, lengthEnd, 'Wall Length', lengthOffset);
			} else if (nameLower.includes('window') || nameLower.includes('door') || nameLower.includes('opening') || 
			           (nameLower.includes('wall') && isSmallObject)) {
				// Detect windows/doors by name OR by being small objects in wall groups
				const label = nameLower.includes('window') ? 'Window' : 
				             nameLower.includes('door') ? 'Door' : 'Opening';
				
				const filterKey = nameLower.includes('window') ? 'showWindows' :
				                 nameLower.includes('door') ? 'showDoors' : 'showOpenings';
				
				if (this.options.debug) {
					console.log(`[DimensionHelper] Processing ${label.toUpperCase()}: "${name}"`, {
						enabled: this.options.filters[filterKey],
						size: size.toArray(),
						center: center.toArray()
					});
				}
				
				if (!this.options.filters[filterKey]) return;
				
				// Windows/Doors/Openings: show width and height using oriented corners
				const offset = this.options.offset;
				
				// Height: vertical edge (corner 0 to corner 4)
				this.addDimension(
					corners[0].clone(),
					corners[4].clone(),
					`${label} Height`,
					new THREE.Vector3(offset * 3, 0, offset * 3)
				);
				
				// Width: along the longer bottom edge
				const edge01Length = corners[0].distanceTo(corners[1]);
				const edge03Length = corners[0].distanceTo(corners[3]);
				
				if (edge01Length > edge03Length) {
					this.addDimension(
						corners[0].clone(),
						corners[1].clone(),
						`${label} Width`,
						new THREE.Vector3(0, offset * 2, 0)
					);
				} else {
					this.addDimension(
						corners[0].clone(),
						corners[3].clone(),
						`${label} Width`,
						new THREE.Vector3(0, offset * 2, 0)
					);
				}
			} else if (nameLower.includes('chair') || nameLower.includes('table') || 
			           nameLower.includes('television') || nameLower.includes('furniture')) {
				if (this.options.debug) {
					console.log(`[DimensionHelper] Processing FURNITURE: "${name}"`, {
						enabled: this.options.filters.showFurniture,
						size: size.toArray(),
						center: center.toArray()
					});
				}
				
				if (!this.options.filters.showFurniture) return;
				
				// Furniture: show basic dimensions using oriented corners
				if (size.length() > 0.1) {
					const offset = this.options.offset;
					
					// Height
					this.addDimension(
						corners[0].clone(),
						corners[4].clone(),
						`${name} Height`,
						new THREE.Vector3(offset, 0, offset)
					);
					
					// Length
					this.addDimension(
						corners[0].clone(),
						corners[1].clone(),
						`${name} Length`,
						new THREE.Vector3(0, -offset, 0)
					);
					
					// Width
					this.addDimension(
						corners[0].clone(),
						corners[3].clone(),
						`${name} Width`,
						new THREE.Vector3(0, -offset, 0)
					);
				}
			}
		};
	}

	/**
	 * Add an arrow at a point
	 */
	private addArrow(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
		const direction = new THREE.Vector3().subVectors(to, from).normalize();
		const arrowLength = 0.05;
		const arrowWidth = 0.02;

		// Create arrow cone
		const arrowGeometry = new THREE.ConeGeometry(arrowWidth, arrowLength, 8);
		const arrowMaterial = new THREE.MeshBasicMaterial({ color });
		const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);

		// Position and orient arrow
		arrow.position.copy(from);
		arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

		this.dimensionGroup.add(arrow);
	}

	/**
	 * Add a text label at a position
	 */
	private addLabel(position: THREE.Vector3, text: string): CSS2DObject {
		const div = document.createElement('div');
		div.className = 'dimension-label';
		div.textContent = text;
		div.style.color = this.options.textColor;
		div.style.fontSize = this.options.textSize;
		div.style.fontFamily = 'monospace';
		div.style.fontWeight = 'bold';
		div.style.padding = '4px 8px';
		div.style.background = 'rgba(255, 255, 255, 0.9)';
		div.style.border = `2px solid ${this.options.textColor}`;
		div.style.borderRadius = '4px';
		div.style.whiteSpace = 'pre';
		div.style.pointerEvents = 'none';
		div.style.userSelect = 'none';

		const label = new CSS2DObject(div);
		label.position.copy(position);
		this.dimensionGroup.add(label);

		return label;
	}

	/**
	 * Format distance based on unit preference
	 */
	private formatDistance(meters: number): string {
		if (this.options.unit === 'feet') {
			const feet = meters * 3.28084;
			const feetInt = Math.floor(feet);
			const inches = Math.round((feet - feetInt) * 12);
			return `${feetInt}' ${inches}"`;
		}
		return `${meters.toFixed(2)}m`;
	}

	/**
	 * Format area based on unit preference
	 */
	private formatArea(squareMeters: number): string {
		if (this.options.unit === 'feet') {
			const sqft = squareMeters * 10.7639;
			return `${sqft.toFixed(1)} sq ft`;
		}
		return `${squareMeters.toFixed(2)} m²`;
	}

	/**
	 * Show or hide dimensions
	 */
	setVisible(visible: boolean): void {
		this.dimensionGroup.visible = visible;
	}

	/**
	 * Update dimension filters
	 */
	updateFilters(filters: Partial<DimensionOptions['filters']>): void {
		Object.assign(this.options.filters, filters);
		
		if (this.options.debug) {
			console.log('[DimensionHelper] Filters updated:', this.options.filters);
		}
	}

	/**
	 * Get current filter settings
	 */
	getFilters(): Required<DimensionOptions>['filters'] {
		return { ...this.options.filters };
	}

	/**
	 * Clear all dimensions
	 */
	clear(): void {
		while (this.dimensionGroup.children.length > 0) {
			const child = this.dimensionGroup.children[0];
			this.dimensionGroup.remove(child);
			
			// Dispose geometries and materials
			if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
				child.geometry.dispose();
				if (Array.isArray(child.material)) {
					child.material.forEach(m => m.dispose());
				} else {
					child.material.dispose();
				}
			}
		}
	}

	/**
	 * Set the model scale factor (for viewport fitting)
	 */
	setModelScale(scale: number): void {
		this.modelScale = scale;
		if (this.options.debug) {
			console.log('[DimensionHelper] Model scale set to:', scale);
		}
	}

	/**
	 * Set the model group reference
	 */
	setModelGroup(group: THREE.Object3D): void {
		this.modelGroup = group;
		if (this.options.debug) {
			console.log('[DimensionHelper] Model group set:', group.name);
		}
	}

	/**
	 * Remove all dimensions and cleanup
	 */
	dispose(): void {
		this.clear();
		this.scene.remove(this.dimensionGroup);
	}
}
