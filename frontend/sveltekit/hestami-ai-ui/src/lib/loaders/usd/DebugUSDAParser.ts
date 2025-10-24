import {
	BufferAttribute,
	BufferGeometry,
	ClampToEdgeWrapping,
	Group,
	NoColorSpace,
	Mesh,
	MeshPhysicalMaterial,
	MirroredRepeatWrapping,
	RepeatWrapping,
	SRGBColorSpace,
	TextureLoader,
	Object3D,
	Vector2
} from 'three';

class DebugUSDAParser {

	parseText( text: string ) {

		const root: any = {};

		const lines = text.split( '\n' );

		let string: string | null = null;
		let target: any = root;

		const stack = [ root ];
		
		// For handling multi-line arrays
		let arrayKey: string | null = null;
		let arrayValue: string[] = [];
		let inArray = false;

		// Parse USDZ file

		for ( const line of lines ) {

			// console.log( line );
			
			// Handle multi-line array continuation
			if ( inArray ) {
				const trimmed = line.trim();
				
				if ( trimmed === ']' ) {
					// End of array
					target[ arrayKey! ] = arrayValue;
					inArray = false;
					arrayKey = null;
					arrayValue = [];
				} else if ( trimmed ) {
					// Array element (remove trailing comma)
					arrayValue.push( trimmed.replace( /,$/, '' ) );
				}
				continue;
			}

			if ( line.includes( '=' ) ) {

				const assignment = line.split( '=' );

				const lhs = assignment[ 0 ].trim();
				const rhs = assignment[ 1 ].trim();

				if ( rhs.endsWith( '{' ) ) {

					const group = {};
					stack.push( group );

					target[ lhs ] = group;
					target = group;

				} else if ( rhs.endsWith( '(' ) ) {

					// see #28631

					const values = rhs.slice( 0, - 1 );
					target[ lhs ] = values;

					const meta = {};
					stack.push( meta );

					target = meta;

				} else if ( rhs === '[' ) {
					
					// Start of multi-line array
					inArray = true;
					arrayKey = lhs;
					arrayValue = [];

				} else {

					target[ lhs ] = rhs;

				}

			} else if ( line.endsWith( '{' ) ) {

				const group = target[ string as string ] || {};
				stack.push( group );

				target[ string as string ] = group;
				target = group;

			} else if ( line.endsWith( '}' ) ) {

				stack.pop();

				if ( stack.length === 0 ) continue;

				target = stack[ stack.length - 1 ];

			} else if ( line.endsWith( '(' ) ) {

				const meta = {};
				stack.push( meta );

				string = line.split( '(' )[ 0 ].trim() || string;

				target[ string as string ] = meta;
				target = meta;

			} else if ( line.endsWith( ')' ) ) {

				stack.pop();

				target = stack[ stack.length - 1 ];

			} else {

				string = line.trim();

			}

		}

		return root;

	}

	parse( text: string, assets: any ) {

		const root = this.parseText( text );
		
		// Store reference to parser for nested functions
		const parser = this;

		// Build scene graph

		function findMeshGeometry( data: any ) {

			if ( ! data ) return undefined;

			if ( 'prepend references' in data ) {

				let references = data[ 'prepend references' ];
				
				console.log('[DebugUSDAParser] Found prepend references:', references);
				console.log('[DebugUSDAParser] Reference type:', typeof references, 'isArray:', Array.isArray( references ));
				
				// Handle both single reference and array of references
				if ( ! Array.isArray( references ) ) {
					references = [ references ];
				}
				
				console.log('[DebugUSDAParser] Processing', references.length, 'reference(s)');
				
				// Helper function to process a single reference
				const processReference = ( reference: string ) => {
					if ( typeof reference !== 'string' ) {
						console.error('[DebugUSDAParser] Reference is not a string:', reference);
						return undefined;
					}

					const parts = reference.split( '@' );
					console.log('[DebugUSDAParser] Split parts:', parts);
					
					if ( parts.length < 2 ) {
						console.error('[DebugUSDAParser] Invalid reference format');
						return undefined;
					}
					
					const path = parts[ 1 ].replace( /^.\//, '' );
					console.log('[DebugUSDAParser] Extracted path:', path);
					
					let assetData = assets[ path ] || assets[ './' + path ];
					
					if ( ! assetData ) {
						console.error('[DebugUSDAParser] Asset not found for path:', path);
						return undefined;
					}
					
					if ( typeof assetData === 'string' ) {
						assetData = parser.parseText( assetData );
					}
					
					const id = parts[ 2 ] ? parts[ 2 ].replace( /^<\//, '' ).replace( />$/, '' ) : undefined;
					const meshGeometry = findGeometry( assetData, id );
					
					if ( ! meshGeometry ) {
						return undefined;
					}
					
					// Build the mesh properly (same as single reference path)
					const geometry = buildGeometry( meshGeometry );
					const material = buildMaterial( findMeshMaterial( assetData ) );
					const mesh = geometry ? new Mesh( geometry, material ) : new Object3D();
					
					// Apply transforms from mesh geometry
					if ( meshGeometry && 'matrix4d xformOp:transform' in meshGeometry ) {
						const transform = JSON.parse( '[' + meshGeometry[ 'matrix4d xformOp:transform' ].replace( /[()]*/g, '' ) + ']' );
						mesh.matrix.fromArray( transform );
						mesh.matrix.decompose( mesh.position, mesh.quaternion, mesh.scale );
						console.log('[DebugUSDAParser] Applied transform, position:', mesh.position.toArray());
					}
					
					return mesh;
				};
				
				// If multiple references, create a group to hold all of them
				if ( references.length > 1 ) {
					const group = new Group();
					group.name = 'MultiRefGroup';
					
					// Process each reference and add to group
					for ( let i = 0; i < references.length; i++ ) {
						const reference = references[ i ];
						console.log(`[DebugUSDAParser] Processing reference ${i + 1}/${references.length}:`, reference);
						
						const child = processReference( reference );
						if ( child ) {
							group.add( child );
						}
					}
					
					return group;
				}
				
				// Single reference - process normally
				const reference = references[ 0 ];
				console.log('[DebugUSDAParser] Processing single reference:', reference);
				
				return processReference( reference );

			}

			return findGeometry( data );

		}

		function findGeometry( data: any, id?: string ): any {

			if ( ! data ) {
				return undefined;
			}

			if ( id !== undefined ) {

				const def = `def Mesh "${id}"`;

				if ( def in data ) {
					console.log('[DebugUSDAParser] Found mesh by ID:', def);
					return data[ def ];

				}

			}

			for ( const name in data ) {

				const object = data[ name ];

				if ( name.startsWith( 'def Mesh' ) ) {
					console.log('[DebugUSDAParser] Found mesh:', name);
					return object;

				}


				if ( typeof object === 'object' ) {

					const geometry = findGeometry( object );

					if ( geometry ) return geometry;

				}

			}
			
			return undefined;

		}

		function buildGeometry( data: any ) {

			if ( ! data ) return undefined;

			const geometry = new BufferGeometry();
			let indices: any = null;
			let counts: any = null;
			let uvs: any = null;

			let positionsLength = - 1;

			// index

			if ( 'int[] faceVertexIndices' in data ) {

				indices = JSON.parse( data[ 'int[] faceVertexIndices' ] );

			}

			// face count

			if ( 'int[] faceVertexCounts' in data ) {

				counts = JSON.parse( data[ 'int[] faceVertexCounts' ] );
				indices = toTriangleIndices( indices, counts );

			}

			// position

			if ( 'point3f[] points' in data ) {

				const positions = JSON.parse( data[ 'point3f[] points' ].replace( /[()]*/g, '' ) );
				positionsLength = positions.length;
				let attribute: any = new BufferAttribute( new Float32Array( positions ), 3 );

				if ( indices !== null ) attribute = toFlatBufferAttribute( attribute, indices );

				geometry.setAttribute( 'position', attribute );

			}

			// uv

			if ( 'float2[] primvars:st' in data ) {

				data[ 'texCoord2f[] primvars:st' ] = data[ 'float2[] primvars:st' ];

			}

			if ( 'texCoord2f[] primvars:st' in data ) {

				uvs = JSON.parse( data[ 'texCoord2f[] primvars:st' ].replace( /[()]*/g, '' ) );
				let attribute: any = new BufferAttribute( new Float32Array( uvs ), 2 );

				if ( indices !== null ) attribute = toFlatBufferAttribute( attribute, indices );

				geometry.setAttribute( 'uv', attribute );

			}

			if ( 'int[] primvars:st:indices' in data && uvs !== null ) {

				// custom uv index, overwrite uvs with new data

				const attribute = new BufferAttribute( new Float32Array( uvs ), 2 );
				let indices = JSON.parse( data[ 'int[] primvars:st:indices' ] );
				indices = toTriangleIndices( indices, counts );
				geometry.setAttribute( 'uv', toFlatBufferAttribute( attribute, indices ) );

			}

			// normal

			if ( 'normal3f[] normals' in data ) {

				const normals = JSON.parse( data[ 'normal3f[] normals' ].replace( /[()]*/g, '' ) );
				let attribute: any = new BufferAttribute( new Float32Array( normals ), 3 );

				// normals require a special treatment in USD

				if ( normals.length === positionsLength ) {

					// raw normal and position data have equal length (like produced by USDZExporter)

					if ( indices !== null ) attribute = toFlatBufferAttribute( attribute, indices );

				} else {

					// unequal length, normals are independent of faceVertexIndices

					let indices: any = Array.from( Array( normals.length / 3 ).keys() ); // [ 0, 1, 2, 3 ... ]
					indices = toTriangleIndices( indices, counts );
					attribute = toFlatBufferAttribute( attribute, indices );

				}

				geometry.setAttribute( 'normal', attribute );

			} else {

				// compute flat vertex normals

				geometry.computeVertexNormals();

			}

			return geometry;

		}

		function toTriangleIndices( rawIndices: any, counts: any ) {

			const indices = [];

			for ( let i = 0; i < counts.length; i ++ ) {

				const count = counts[ i ];

				const stride = i * count;

				if ( count === 3 ) {

					const a = rawIndices[ stride + 0 ];
					const b = rawIndices[ stride + 1 ];
					const c = rawIndices[ stride + 2 ];

					indices.push( a, b, c );

				} else if ( count === 4 ) {

					const a = rawIndices[ stride + 0 ];
					const b = rawIndices[ stride + 1 ];
					const c = rawIndices[ stride + 2 ];
					const d = rawIndices[ stride + 3 ];

					indices.push( a, b, c );
					indices.push( a, c, d );

				} else {

					console.warn( 'THREE.USDZLoader: Face vertex count of %s unsupported.', count );

				}

			}

			return indices;

		}

		function toFlatBufferAttribute( attribute: BufferAttribute, indices: any ) {

			const array = attribute.array;
			const itemSize = attribute.itemSize;

			const array2 = new (array.constructor as any)( indices.length * itemSize );

			let index = 0, index2 = 0;

			for ( let i = 0, l = indices.length; i < l; i ++ ) {

				index = indices[ i ] * itemSize;

				for ( let j = 0; j < itemSize; j ++ ) {

					array2[ index2 ++ ] = array[ index ++ ];

				}

			}

			return new BufferAttribute( array2, itemSize );

		}

		function findMeshMaterial( data: any ): any {

			if ( ! data ) return undefined;

			if ( 'rel material:binding' in data ) {

				const reference = data[ 'rel material:binding' ];
				const id = reference.replace( /^<\//, '' ).replace( />$/, '' );
				const parts = id.split( '/' );

				return findMaterial( root, ` "${ parts[ 1 ] }"` );

			}

			return findMaterial( data );

		}

		function findMaterial( data: any, id = '' ): any {

			for ( const name in data ) {

				const object = data[ name ];

				if ( name.startsWith( 'def Material' + id ) ) {

					return object;

				}

				if ( typeof object === 'object' ) {

					const material = findMaterial( object, id );

					if ( material ) return material;

				}

			}

		}

		function setTextureParams( map: any, data_value: any ) {

			// rotation, scale and translation

			if ( data_value[ 'float inputs:rotation' ] ) {

				map.rotation = parseFloat( data_value[ 'float inputs:rotation' ] );

			}

			if ( data_value[ 'float2 inputs:scale' ] ) {

				map.repeat = new Vector2().fromArray( JSON.parse( '[' + data_value[ 'float2 inputs:scale' ].replace( /[()]*/g, '' ) + ']' ) );

			}

			if ( data_value[ 'float2 inputs:translation' ] ) {

				map.offset = new Vector2().fromArray( JSON.parse( '[' + data_value[ 'float2 inputs:translation' ].replace( /[()]*/g, '' ) + ']' ) );

			}

		}

		function buildMaterial( data: any ) {

			const material = new MeshPhysicalMaterial();

			if ( data !== undefined ) {

				let surface = undefined;

				const surfaceConnection = data[ 'token outputs:surface.connect' ];

				if ( surfaceConnection ) {

					const match = /(\w+)\.output/.exec( surfaceConnection );

					if ( match ) {

						const surfaceName = match[ 1 ];
						surface = data[ `def Shader "${surfaceName}"` ];

					}

				}

				if ( surface !== undefined ) {

					if ( 'color3f inputs:diffuseColor.connect' in surface ) {

						const path = surface[ 'color3f inputs:diffuseColor.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )![ 1 ] );

						material.map = buildTexture( sampler );
						if ( material.map ) material.map.colorSpace = SRGBColorSpace;

						if ( 'def Shader "Transform2d_diffuse"' in data ) {

							setTextureParams( material.map, data[ 'def Shader "Transform2d_diffuse"' ] );

						}

					} else if ( 'color3f inputs:diffuseColor' in surface ) {

						const color = surface[ 'color3f inputs:diffuseColor' ].replace( /[()]*/g, '' );
						material.color.fromArray( JSON.parse( '[' + color + ']' ) );

					}

					if ( 'color3f inputs:emissiveColor.connect' in surface ) {

						const path = surface[ 'color3f inputs:emissiveColor.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )![ 1 ] );

						material.emissiveMap = buildTexture( sampler );
						if ( material.emissiveMap ) {
							material.emissiveMap.colorSpace = SRGBColorSpace;
							material.emissive.set( 0xffffff );
						}

						if ( 'def Shader "Transform2d_emissive"' in data ) {

							setTextureParams( material.emissiveMap, data[ 'def Shader "Transform2d_emissive"' ] );

						}

					} else if ( 'color3f inputs:emissiveColor' in surface ) {

						const color = surface[ 'color3f inputs:emissiveColor' ].replace( /[()]*/g, '' );
						material.emissive.fromArray( JSON.parse( '[' + color + ']' ) );

					}

					if ( 'normal3f inputs:normal.connect' in surface ) {

						const path = surface[ 'normal3f inputs:normal.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )![ 1 ] );

						material.normalMap = buildTexture( sampler );
						if ( material.normalMap ) material.normalMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_normal"' in data ) {

							setTextureParams( material.normalMap, data[ 'def Shader "Transform2d_normal"' ] );

						}

					}

					if ( 'float inputs:roughness.connect' in surface ) {

						const path = surface[ 'float inputs:roughness.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )![ 1 ] );

						material.roughness = 1.0;
						material.roughnessMap = buildTexture( sampler );
						if ( material.roughnessMap ) material.roughnessMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_roughness"' in data ) {

							setTextureParams( material.roughnessMap, data[ 'def Shader "Transform2d_roughness"' ] );

						}

					} else if ( 'float inputs:roughness' in surface ) {

						material.roughness = parseFloat( surface[ 'float inputs:roughness' ] );

					}

					if ( 'float inputs:metallic.connect' in surface ) {

						const path = surface[ 'float inputs:metallic.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )![ 1 ] );

						material.metalness = 1.0;
						material.metalnessMap = buildTexture( sampler );
						if ( material.metalnessMap ) material.metalnessMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_metallic"' in data ) {

							setTextureParams( material.metalnessMap, data[ 'def Shader "Transform2d_metallic"' ] );

						}

					} else if ( 'float inputs:metallic' in surface ) {

						material.metalness = parseFloat( surface[ 'float inputs:metallic' ] );

					}

					if ( 'float inputs:clearcoat.connect' in surface ) {

						const path = surface[ 'float inputs:clearcoat.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )![ 1 ] );

						material.clearcoat = 1.0;
						material.clearcoatMap = buildTexture( sampler );
						if ( material.clearcoatMap ) material.clearcoatMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_clearcoat"' in data ) {

							setTextureParams( material.clearcoatMap, data[ 'def Shader "Transform2d_clearcoat"' ] );

						}

					} else if ( 'float inputs:clearcoat' in surface ) {

						material.clearcoat = parseFloat( surface[ 'float inputs:clearcoat' ] );

					}

					if ( 'float inputs:clearcoatRoughness.connect' in surface ) {

						const path = surface[ 'float inputs:clearcoatRoughness.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )![ 1 ] );

						material.clearcoatRoughness = 1.0;
						material.clearcoatRoughnessMap = buildTexture( sampler );
						if ( material.clearcoatRoughnessMap ) material.clearcoatRoughnessMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_clearcoatRoughness"' in data ) {

							setTextureParams( material.clearcoatRoughnessMap, data[ 'def Shader "Transform2d_clearcoatRoughness"' ] );

						}

					} else if ( 'float inputs:clearcoatRoughness' in surface ) {

						material.clearcoatRoughness = parseFloat( surface[ 'float inputs:clearcoatRoughness' ] );

					}

					if ( 'float inputs:ior' in surface ) {

						material.ior = parseFloat( surface[ 'float inputs:ior' ] );

					}

					if ( 'float inputs:occlusion.connect' in surface ) {

						const path = surface[ 'float inputs:occlusion.connect' ];
						const sampler = findTexture( root, /(\w+).output/.exec( path )![ 1 ] );

						material.aoMap = buildTexture( sampler );
						if ( material.aoMap ) material.aoMap.colorSpace = NoColorSpace;

						if ( 'def Shader "Transform2d_occlusion"' in data ) {

							setTextureParams( material.aoMap, data[ 'def Shader "Transform2d_occlusion"' ] );

						}

					}

				}

			}

			return material;

		}

		function findTexture( data: any, id: string ): any {

			for ( const name in data ) {

				const object = data[ name ];

				if ( name.startsWith( `def Shader "${ id }"` ) ) {

					return object;

				}

				if ( typeof object === 'object' ) {

					const texture = findTexture( object, id );

					if ( texture ) return texture;

				}

			}

		}

		function buildTexture( data: any ) {

			if ( data && 'asset inputs:file' in data ) {

				const path = data[ 'asset inputs:file' ].replace( /@*/g, '' ).trim();

				const loader = new TextureLoader();

				const texture = loader.load( assets[ path ] );

				const map: any = {
					'"clamp"': ClampToEdgeWrapping,
					'"mirror"': MirroredRepeatWrapping,
					'"repeat"': RepeatWrapping
				};

				if ( 'token inputs:wrapS' in data ) {

					texture.wrapS = map[ data[ 'token inputs:wrapS' ] ];

				}

				if ( 'token inputs:wrapT' in data ) {

					texture.wrapT = map[ data[ 'token inputs:wrapT' ] ];

				}

				return texture;

			}

			return null;

		}

		function buildObject( data: any ) {

			const meshGeometry = findMeshGeometry( data );
			
			// Check if findMeshGeometry returned an already-built Mesh or Group (from processReference)
			if ( meshGeometry && ( meshGeometry.isMesh || meshGeometry.isGroup || meshGeometry.isObject3D ) ) {
				console.log('[DebugUSDAParser] findMeshGeometry returned a built object, returning directly');
				return meshGeometry;
			}
			
			const geometry = buildGeometry( meshGeometry );
			const material = buildMaterial( findMeshMaterial( data ) );

			const mesh = geometry ? new Mesh( geometry, material ) : new Object3D();

			// Apply transforms from mesh geometry (RoomPlan stores transforms in the Mesh definition)
			if ( meshGeometry ) {
				// Debug: Show first 5 keys
				const keys = Object.keys(meshGeometry);
				console.log('[DebugUSDAParser] Mesh geometry has', keys.length, 'keys, first 10:', keys.slice(0, 10));
				
				// Check for transform matrix
				if ( 'matrix4d xformOp:transform' in meshGeometry ) {
					console.log('[DebugUSDAParser] Found matrix4d xformOp:transform in Mesh data');
					const array = JSON.parse( '[' + meshGeometry[ 'matrix4d xformOp:transform' ].replace( /[()]*/g, '' ) + ']' );
					mesh.matrix.fromArray( array );
					mesh.matrix.decompose( mesh.position, mesh.quaternion, mesh.scale );
					console.log('[DebugUSDAParser] Applied transform, position:', mesh.position.toArray());
				}
			}

			return mesh;

		}

		function buildHierarchy( data: any, group: Group | Mesh | Object3D ) {

			for ( const name in data ) {

				if ( name.startsWith( 'def Scope' ) ) {

					buildHierarchy( data[ name ], group );

				} else if ( name.startsWith( 'def Xform' ) ) {

					const mesh = buildObject( data[ name ] );

					if ( /def Xform "(\w+)"/.test( name ) ) {

						mesh.name = /def Xform "(\w+)"/.exec( name )![ 1 ];

					}

					group.add( mesh );

					buildHierarchy( data[ name ], mesh );

				}

			}

		}

		function buildGroup( data: any ) {

			const group = new Group();

			buildHierarchy( data, group );

			return group;

		}

		return buildGroup( root );

	}

}

export { DebugUSDAParser };
