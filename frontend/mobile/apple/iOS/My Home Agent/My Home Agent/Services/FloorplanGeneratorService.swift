import Foundation
import RoomPlan
import UIKit

extension UIColor {
    func darker() -> UIColor {
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        return UIColor(hue: h, saturation: s, brightness: b * 0.7, alpha: a)
    }
}

class FloorplanGeneratorService {
    static let shared = FloorplanGeneratorService()
    
    private init() {}
    
    // MARK: - Generate Floorplan Image
    
    func generateFloorplan(from capturedRoom: CapturedRoom, size: CGSize = CGSize(width: 1024, height: 1024), useMetric: Bool = true) -> UIImage? {
        print("🏗️ FloorplanGenerator: Starting floorplan generation (useMetric: \(useMetric))")
        
        // Calculate dominant wall angle to align floorplan
        let alignmentAngle = calculateAlignmentAngle(from: capturedRoom)
        print("   Alignment angle: \(alignmentAngle * 180 / .pi) degrees")
        
        // Calculate room bounds AFTER rotation for proper centering
        let bounds = calculateRoomBounds(from: capturedRoom, alignmentAngle: alignmentAngle)
        print("   Room bounds (after rotation): (minX: \(bounds.minX), maxX: \(bounds.maxX), minZ: \(bounds.minZ), maxZ: \(bounds.maxZ))")
        
        // Create image context
        let renderer = UIGraphicsImageRenderer(size: size)
        
        let image = renderer.image { context in
            let ctx = context.cgContext
            
            // Background
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            
            // Reserve space for legend (bottom-right corner) and dimension labels (all sides)
            let legendWidth: CGFloat = 200  // 180 + padding
            let legendHeight: CGFloat = 180 // Approximate max height
            let legendPadding: CGFloat = 20
            let labelPadding: CGFloat = 60  // Extra padding for dimension labels on all sides
            
            // Calculate scale to fit room in image, accounting for legend space and label padding
            let scale = calculateScale(bounds: bounds, imageSize: size, legendWidth: legendWidth, legendHeight: legendHeight, legendPadding: legendPadding, labelPadding: labelPadding)
            let offset = calculateOffset(bounds: bounds, imageSize: size, scale: scale, legendWidth: legendWidth, legendHeight: legendHeight, legendPadding: legendPadding, labelPadding: labelPadding)
            
            print("   Scale: \(scale), Offset: (\(offset.x), \(offset.y))")
            print("   Canvas size: \(size.width) x \(size.height)")
            
            // Log what we found
            print("   RoomPlan detected:")
            print("      Walls: \(capturedRoom.walls.count)")
            print("      Doors: \(capturedRoom.doors.count)")
            print("      Windows: \(capturedRoom.windows.count)")
            print("      Openings: \(capturedRoom.openings.count)")
            print("      Objects: \(capturedRoom.objects.count)")
            
            // Combine all surfaces for reclassification
            var allSurfaces: [CapturedRoom.Surface] = []
            allSurfaces.append(contentsOf: capturedRoom.walls)
            allSurfaces.append(contentsOf: capturedRoom.doors)
            allSurfaces.append(contentsOf: capturedRoom.windows)
            allSurfaces.append(contentsOf: capturedRoom.openings)
            
            // Reclassify surfaces using heuristics (in case RoomPlan misclassified)
            let reclassified = reclassifySurfaces(allSurfaces)
            
            // Draw walls (only actual walls, not doors/windows)
            print("   Drawing \(reclassified.walls.count) walls")
            drawWalls(reclassified.walls, context: ctx, scale: scale, offset: offset, bounds: bounds, alignmentAngle: alignmentAngle)
            
            // Draw doors
            print("   Drawing \(reclassified.doors.count) doors")
            drawDoors(reclassified.doors, context: ctx, scale: scale, offset: offset, bounds: bounds, alignmentAngle: alignmentAngle)
            
            // Draw windows
            print("   Drawing \(reclassified.windows.count) windows")
            drawWindows(reclassified.windows, context: ctx, scale: scale, offset: offset, bounds: bounds, alignmentAngle: alignmentAngle)
            
            // Draw openings
            print("   Drawing \(reclassified.openings.count) openings")
            drawOpenings(reclassified.openings, context: ctx, scale: scale, offset: offset, bounds: bounds, alignmentAngle: alignmentAngle)
            
            // Draw furniture and objects
            drawObjects(capturedRoom.objects, context: ctx, scale: scale, offset: offset, bounds: bounds, alignmentAngle: alignmentAngle)
            
            // Draw dimensions/labels
            drawDimensions(capturedRoom.walls, context: ctx, scale: scale, offset: offset, bounds: bounds, alignmentAngle: alignmentAngle, useMetric: useMetric)
            
            // Draw legend
            drawLegend(context: ctx, imageSize: size, hasWindows: !reclassified.windows.isEmpty, hasDoors: !reclassified.doors.isEmpty, hasOpenings: !reclassified.openings.isEmpty)
        }
        
        print("✅ FloorplanGenerator: Floorplan generated")
        return image
    }
    
    // MARK: - Surface Reclassification
    
    private func reclassifySurfaces(_ surfaces: [CapturedRoom.Surface]) -> (walls: [CapturedRoom.Surface], doors: [CapturedRoom.Surface], windows: [CapturedRoom.Surface], openings: [CapturedRoom.Surface]) {
        var walls: [CapturedRoom.Surface] = []
        var doors: [CapturedRoom.Surface] = []
        var windows: [CapturedRoom.Surface] = []
        var openings: [CapturedRoom.Surface] = []
        
        print("🔍 Analyzing \(surfaces.count) surfaces for reclassification...")
        
        for (index, surface) in surfaces.enumerated() {
            // First check if RoomPlan already classified it correctly
            switch surface.category {
            case .wall:
                print("   Surface \(index): wall - checking heuristics")
                break // Continue to heuristics
            case .door:
                print("   Surface \(index): door (pre-classified)")
                doors.append(surface)
                continue
            case .window:
                print("   Surface \(index): window (pre-classified)")
                windows.append(surface)
                continue
            case .opening:
                print("   Surface \(index): opening (pre-classified)")
                openings.append(surface)
                continue
            case .floor:
                print("   Surface \(index): floor (ignored)")
                continue // Ignore floors
            @unknown default:
                print("   Surface \(index): unknown category")
                walls.append(surface)
                continue
            }
            
            // Apply heuristics to reclassify walls
            let dimensions = surface.dimensions
            let width = dimensions.x
            let height = dimensions.y
            
            // Get vertical position (Y coordinate)
            let transform = surface.transform
            let yPosition = transform.columns.3.y
            
            print("      Dimensions: width=\(width)m, height=\(height)m, y=\(yPosition)m")
            
            // Heuristics for windows:
            // - Smaller width (< 3.0m)
            // - Higher Y position (> 0.4m from floor)
            // - Shorter height (< 2.2m)
            if width < 3.0 && height < 2.2 && yPosition > 0.4 {
                print("   🪟 Reclassified surface as WINDOW (width: \(width)m, height: \(height)m, y: \(yPosition)m)")
                windows.append(surface)
                continue
            }
            
            // Heuristics for doors:
            // - Medium width (0.5m - 1.5m)
            // - Full height (> 1.5m)
            // - Low Y position (near floor, < 0.5m)
            if width > 0.5 && width < 1.5 && height > 1.5 && yPosition < 0.5 {
                print("   🚪 Reclassified surface as DOOR (width: \(width)m, height: \(height)m, y: \(yPosition)m)")
                doors.append(surface)
                continue
            }
            
            // Heuristics for openings (doorways without doors):
            // - Medium to wide width (0.7m - 2.5m)
            // - Full height (> 1.8m)
            // - Low Y position
            if width > 0.7 && width < 2.5 && height > 1.8 && yPosition < 0.5 {
                print("   🚶 Reclassified surface as OPENING (width: \(width)m, height: \(height)m, y: \(yPosition)m)")
                openings.append(surface)
                continue
            }
            
            // Default: keep as wall
            print("      → Keeping as WALL")
            walls.append(surface)
        }
        
        print("📊 Reclassification results:")
        print("   Walls: \(walls.count)")
        print("   Doors: \(doors.count)")
        print("   Windows: \(windows.count)")
        print("   Openings: \(openings.count)")
        
        return (walls, doors, windows, openings)
    }
    
    // MARK: - Calculate Alignment Angle
    
    private func calculateAlignmentAngle(from room: CapturedRoom) -> Float {
        // Find the longest wall to use as alignment reference
        var longestWall: CapturedRoom.Surface?
        var maxLength: Float = 0
        
        // Check all wall surfaces (not doors/windows/openings)
        for wall in room.walls {
            let length = wall.dimensions.x
            if length > maxLength {
                maxLength = length
                longestWall = wall
            }
        }
        
        guard let wall = longestWall else { return 0 }
        
        // Extract rotation angle from transform - use the actual angle without snapping
        let transform = wall.transform
        let angle = atan2(transform.columns.0.z, transform.columns.0.x)
        
        print("   Longest wall: \(maxLength)m, angle: \(angle * 180 / .pi)°")
        
        // Return the negative angle to align the longest wall horizontally
        return -angle
    }
    
    // MARK: - Calculate Room Bounds
    
    private func calculateRoomBounds(from room: CapturedRoom, alignmentAngle: Float) -> (minX: Float, maxX: Float, minZ: Float, maxZ: Float) {
        var minX: Float = .infinity
        var maxX: Float = -.infinity
        var minZ: Float = .infinity
        var maxZ: Float = -.infinity
        
        // Combine all surfaces to calculate bounds
        var allSurfaces: [CapturedRoom.Surface] = []
        allSurfaces.append(contentsOf: room.walls)
        allSurfaces.append(contentsOf: room.doors)
        allSurfaces.append(contentsOf: room.windows)
        allSurfaces.append(contentsOf: room.openings)
        
        let cosAlign = cos(alignmentAngle)
        let sinAlign = sin(alignmentAngle)
        
        for surface in allSurfaces {
            let transform = surface.transform
            var position = SIMD3<Float>(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
            
            // Apply alignment rotation to position BEFORE calculating bounds
            let rotatedX = position.x * cosAlign - position.z * sinAlign
            let rotatedZ = position.x * sinAlign + position.z * cosAlign
            position.x = rotatedX
            position.z = rotatedZ
            
            // Get surface dimensions and rotation
            let width = surface.dimensions.x
            let rotationY = atan2(transform.columns.0.z, transform.columns.0.x) + alignmentAngle
            
            let halfWidth = width / 2
            let cosAngle = cos(rotationY)
            let sinAngle = sin(rotationY)
            
            // Calculate rotated endpoints
            let x1 = position.x - halfWidth * cosAngle
            let z1 = position.z - halfWidth * sinAngle
            let x2 = position.x + halfWidth * cosAngle
            let z2 = position.z + halfWidth * sinAngle
            
            minX = min(minX, x1, x2)
            maxX = max(maxX, x1, x2)
            minZ = min(minZ, z1, z2)
            maxZ = max(maxZ, z1, z2)
        }
        
        return (minX, maxX, minZ, maxZ)
    }
    
    private func calculateScale(bounds: (minX: Float, maxX: Float, minZ: Float, maxZ: Float), imageSize: CGSize, legendWidth: CGFloat, legendHeight: CGFloat, legendPadding: CGFloat, labelPadding: CGFloat) -> CGFloat {
        let roomWidth = CGFloat(bounds.maxX - bounds.minX)
        let roomDepth = CGFloat(bounds.maxZ - bounds.minZ)
        
        // Reserve space for legend in bottom-right corner and labels on all sides
        let availableWidth = imageSize.width - legendWidth - legendPadding - (labelPadding * 2)
        let availableHeight = imageSize.height - legendHeight - legendPadding - (labelPadding * 2)
        
        let scaleX = availableWidth / roomWidth
        let scaleZ = availableHeight / roomDepth
        
        return min(scaleX, scaleZ)
    }
    
    private func calculateOffset(bounds: (minX: Float, maxX: Float, minZ: Float, maxZ: Float), imageSize: CGSize, scale: CGFloat, legendWidth: CGFloat, legendHeight: CGFloat, legendPadding: CGFloat, labelPadding: CGFloat) -> CGPoint {
        let roomWidth = CGFloat(bounds.maxX - bounds.minX)
        let roomDepth = CGFloat(bounds.maxZ - bounds.minZ)
        
        let scaledWidth = roomWidth * scale
        let scaledDepth = roomDepth * scale
        
        // Center in the available space (excluding legend area and label padding)
        let availableWidth = imageSize.width - legendWidth - legendPadding - (labelPadding * 2)
        let availableHeight = imageSize.height - legendHeight - legendPadding - (labelPadding * 2)
        
        // Add labelPadding to shift everything away from edges
        let offsetX = labelPadding + (availableWidth - scaledWidth) / 2 - CGFloat(bounds.minX) * scale
        let offsetY = labelPadding + (availableHeight - scaledDepth) / 2 - CGFloat(bounds.minZ) * scale
        
        return CGPoint(x: offsetX, y: offsetY)
    }
    
    // MARK: - Draw Elements
    
    private func drawWalls(_ walls: [CapturedRoom.Surface], context: CGContext, scale: CGFloat, offset: CGPoint, bounds: (minX: Float, maxX: Float, minZ: Float, maxZ: Float), alignmentAngle: Float) {
        context.setStrokeColor(UIColor.black.cgColor)
        context.setLineWidth(4.0)
        context.setFillColor(UIColor(white: 0.95, alpha: 1.0).cgColor)
        
        // Extract wall line segments
        var wallSegments: [(start: CGPoint, end: CGPoint)] = []
        
        for wall in walls {
            let transform = wall.transform
            let dimensions = wall.dimensions
            
            // Get wall center position
            var position = SIMD3<Float>(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
            
            // Apply alignment rotation to position
            let cosAlign = cos(alignmentAngle)
            let sinAlign = sin(alignmentAngle)
            let rotatedX = position.x * cosAlign - position.z * sinAlign
            let rotatedZ = position.x * sinAlign + position.z * cosAlign
            position.x = rotatedX
            position.z = rotatedZ
            
            // Get wall rotation (extract rotation from transform matrix)
            let rotationY = atan2(transform.columns.0.z, transform.columns.0.x) + alignmentAngle
            
            // Calculate wall endpoints based on rotation
            let halfWidth = dimensions.x / 2
            let cosAngle = cos(rotationY)
            let sinAngle = sin(rotationY)
            
            // Calculate start and end points of the wall
            let startX = position.x - halfWidth * cosAngle
            let startZ = position.z - halfWidth * sinAngle
            let endX = position.x + halfWidth * cosAngle
            let endZ = position.z + halfWidth * sinAngle
            
            // Convert to screen coordinates
            let start = CGPoint(
                x: CGFloat(startX) * scale + offset.x,
                y: CGFloat(startZ) * scale + offset.y
            )
            let end = CGPoint(
                x: CGFloat(endX) * scale + offset.x,
                y: CGFloat(endZ) * scale + offset.y
            )
            
            wallSegments.append((start, end))
        }
        
        // Draw all wall segments
        for segment in wallSegments {
            context.move(to: segment.start)
            context.addLine(to: segment.end)
        }
        context.strokePath()
    }
    
    private func drawDoors(_ doors: [CapturedRoom.Surface], context: CGContext, scale: CGFloat, offset: CGPoint, bounds: (minX: Float, maxX: Float, minZ: Float, maxZ: Float), alignmentAngle: Float) {
        context.setStrokeColor(UIColor.brown.cgColor)
        context.setLineWidth(2.0)
        context.setLineDash(phase: 0, lengths: [5, 5])
        
        for door in doors {
            let transform = door.transform
            var position = SIMD3<Float>(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
            let dimensions = door.dimensions
            
            // Apply alignment rotation to position
            let cosAlign = cos(alignmentAngle)
            let sinAlign = sin(alignmentAngle)
            let rotatedX = position.x * cosAlign - position.z * sinAlign
            let rotatedZ = position.x * sinAlign + position.z * cosAlign
            position.x = rotatedX
            position.z = rotatedZ
            
            // Get door rotation
            let rotationY = atan2(transform.columns.0.z, transform.columns.0.x) + alignmentAngle
            
            let halfWidth = dimensions.x / 2
            let cosAngle = cos(rotationY)
            let sinAngle = sin(rotationY)
            
            // Calculate door endpoints
            let startX = position.x - halfWidth * cosAngle
            let startZ = position.z - halfWidth * sinAngle
            let endX = position.x + halfWidth * cosAngle
            let endZ = position.z + halfWidth * sinAngle
            
            let start = CGPoint(
                x: CGFloat(startX) * scale + offset.x,
                y: CGFloat(startZ) * scale + offset.y
            )
            let end = CGPoint(
                x: CGFloat(endX) * scale + offset.x,
                y: CGFloat(endZ) * scale + offset.y
            )
            
            // Draw door as dashed line
            context.move(to: start)
            context.addLine(to: end)
        }
        context.strokePath()
        context.setLineDash(phase: 0, lengths: [])
    }
    
    private func drawWindows(_ windows: [CapturedRoom.Surface], context: CGContext, scale: CGFloat, offset: CGPoint, bounds: (minX: Float, maxX: Float, minZ: Float, maxZ: Float), alignmentAngle: Float) {
        print("   🪟 Drawing \(windows.count) windows...")
        context.setStrokeColor(UIColor.systemBlue.cgColor)
        context.setLineWidth(6.0)  // Thicker to be more visible
        
        for (index, window) in windows.enumerated() {
            let transform = window.transform
            var position = SIMD3<Float>(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
            let dimensions = window.dimensions
            
            // Apply alignment rotation to position
            let cosAlign = cos(alignmentAngle)
            let sinAlign = sin(alignmentAngle)
            let rotatedX = position.x * cosAlign - position.z * sinAlign
            let rotatedZ = position.x * sinAlign + position.z * cosAlign
            position.x = rotatedX
            position.z = rotatedZ
            
            // Get window rotation
            let rotationY = atan2(transform.columns.0.z, transform.columns.0.x) + alignmentAngle
            
            let halfWidth = dimensions.x / 2
            let cosAngle = cos(rotationY)
            let sinAngle = sin(rotationY)
            
            // Calculate window endpoints
            let startX = position.x - halfWidth * cosAngle
            let startZ = position.z - halfWidth * sinAngle
            let endX = position.x + halfWidth * cosAngle
            let endZ = position.z + halfWidth * sinAngle
            
            let start = CGPoint(
                x: CGFloat(startX) * scale + offset.x,
                y: CGFloat(startZ) * scale + offset.y
            )
            let end = CGPoint(
                x: CGFloat(endX) * scale + offset.x,
                y: CGFloat(endZ) * scale + offset.y
            )
            
            // Draw window as thick blue line
            print("      Window \(index): from (\(start.x), \(start.y)) to (\(end.x), \(end.y))")
            context.move(to: start)
            context.addLine(to: end)
        }
        context.strokePath()
        print("   ✅ Windows drawn")
    }
    
    private func drawOpenings(_ openings: [CapturedRoom.Surface], context: CGContext, scale: CGFloat, offset: CGPoint, bounds: (minX: Float, maxX: Float, minZ: Float, maxZ: Float), alignmentAngle: Float) {
        print("   🚶 Drawing \(openings.count) openings...")
        context.setStrokeColor(UIColor.systemRed.cgColor)  // Changed to red for visibility
        context.setLineWidth(5.0)  // Thicker
        context.setLineDash(phase: 0, lengths: [8, 4])  // Longer dashes
        
        for (index, opening) in openings.enumerated() {
            let transform = opening.transform
            var position = SIMD3<Float>(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
            let dimensions = opening.dimensions
            
            // Apply alignment rotation to position
            let cosAlign = cos(alignmentAngle)
            let sinAlign = sin(alignmentAngle)
            let rotatedX = position.x * cosAlign - position.z * sinAlign
            let rotatedZ = position.x * sinAlign + position.z * cosAlign
            position.x = rotatedX
            position.z = rotatedZ
            
            // Get opening rotation
            let rotationY = atan2(transform.columns.0.z, transform.columns.0.x) + alignmentAngle
            
            let halfWidth = dimensions.x / 2
            let cosAngle = cos(rotationY)
            let sinAngle = sin(rotationY)
            
            // Calculate opening endpoints
            let startX = position.x - halfWidth * cosAngle
            let startZ = position.z - halfWidth * sinAngle
            let endX = position.x + halfWidth * cosAngle
            let endZ = position.z + halfWidth * sinAngle
            
            let start = CGPoint(
                x: CGFloat(startX) * scale + offset.x,
                y: CGFloat(startZ) * scale + offset.y
            )
            let end = CGPoint(
                x: CGFloat(endX) * scale + offset.x,
                y: CGFloat(endZ) * scale + offset.y
            )
            
            // Draw opening as dashed red line
            print("      Opening \(index): from (\(start.x), \(start.y)) to (\(end.x), \(end.y))")
            context.move(to: start)
            context.addLine(to: end)
        }
        context.strokePath()
        context.setLineDash(phase: 0, lengths: [])
        print("   ✅ Openings drawn")
    }
    
    private func drawObjects(_ objects: [CapturedRoom.Object], context: CGContext, scale: CGFloat, offset: CGPoint, bounds: (minX: Float, maxX: Float, minZ: Float, maxZ: Float), alignmentAngle: Float) {
        for object in objects {
            let transform = object.transform
            var position = SIMD3<Float>(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
            let dimensions = object.dimensions
            
            // Apply alignment rotation to position
            let cosAlign = cos(alignmentAngle)
            let sinAlign = sin(alignmentAngle)
            let rotatedX = position.x * cosAlign - position.z * sinAlign
            let rotatedZ = position.x * sinAlign + position.z * cosAlign
            position.x = rotatedX
            position.z = rotatedZ
            
            // Get object rotation
            let rotationY = atan2(transform.columns.0.z, transform.columns.0.x) + alignmentAngle
            
            // Get color based on category
            let color = colorForObjectCategory(object.category)
            context.setFillColor(color.cgColor)
            context.setStrokeColor(color.darker().cgColor)
            context.setLineWidth(1.5)
            
            // Draw object as rotated rectangle
            let halfWidth = dimensions.x / 2
            let halfDepth = dimensions.z / 2
            
            // Calculate corners
            let cosAngle = cos(rotationY)
            let sinAngle = sin(rotationY)
            
            let corners = [
                (x: -halfWidth, z: -halfDepth),
                (x: halfWidth, z: -halfDepth),
                (x: halfWidth, z: halfDepth),
                (x: -halfWidth, z: halfDepth)
            ]
            
            var points: [CGPoint] = []
            for corner in corners {
                let rotatedX = position.x + corner.x * cosAngle - corner.z * sinAngle
                let rotatedZ = position.z + corner.x * sinAngle + corner.z * cosAngle
                
                let point = CGPoint(
                    x: CGFloat(rotatedX) * scale + offset.x,
                    y: CGFloat(rotatedZ) * scale + offset.y
                )
                points.append(point)
            }
            
            // Draw filled rectangle
            context.move(to: points[0])
            for i in 1..<points.count {
                context.addLine(to: points[i])
            }
            context.closePath()
            context.drawPath(using: .fillStroke)
            
            // Draw label
            let centerPoint = CGPoint(
                x: CGFloat(position.x) * scale + offset.x,
                y: CGFloat(position.z) * scale + offset.y
            )
            drawObjectLabel(object.category, at: centerPoint, context: context)
        }
    }
    
    private func colorForObjectCategory(_ category: CapturedRoom.Object.Category) -> UIColor {
        switch category {
        case .storage:
            return UIColor(red: 0.8, green: 0.6, blue: 0.4, alpha: 0.6) // Brown
        case .refrigerator:
            return UIColor(red: 0.9, green: 0.9, blue: 0.9, alpha: 0.6) // Light gray
        case .stove:
            return UIColor(red: 0.3, green: 0.3, blue: 0.3, alpha: 0.6) // Dark gray
        case .bed:
            return UIColor(red: 0.7, green: 0.5, blue: 0.7, alpha: 0.6) // Purple
        case .sink:
            return UIColor(red: 0.6, green: 0.8, blue: 0.9, alpha: 0.6) // Light blue
        case .washerDryer:
            return UIColor(red: 0.5, green: 0.7, blue: 0.9, alpha: 0.6) // Blue
        case .toilet:
            return UIColor(red: 0.9, green: 0.9, blue: 1.0, alpha: 0.6) // Very light blue
        case .bathtub:
            return UIColor(red: 0.7, green: 0.9, blue: 1.0, alpha: 0.6) // Cyan
        case .oven:
            return UIColor(red: 0.4, green: 0.4, blue: 0.4, alpha: 0.6) // Gray
        case .dishwasher:
            return UIColor(red: 0.6, green: 0.6, blue: 0.6, alpha: 0.6) // Medium gray
        case .table:
            return UIColor(red: 0.7, green: 0.5, blue: 0.3, alpha: 0.6) // Wood brown
        case .sofa:
            return UIColor(red: 0.6, green: 0.7, blue: 0.6, alpha: 0.6) // Green
        case .chair:
            return UIColor(red: 0.7, green: 0.6, blue: 0.5, alpha: 0.6) // Tan
        case .fireplace:
            return UIColor(red: 0.8, green: 0.3, blue: 0.2, alpha: 0.6) // Red
        case .television:
            return UIColor(red: 0.2, green: 0.2, blue: 0.2, alpha: 0.6) // Black
        case .stairs:
            return UIColor(red: 0.5, green: 0.5, blue: 0.5, alpha: 0.6) // Gray
        @unknown default:
            return UIColor(red: 0.7, green: 0.7, blue: 0.7, alpha: 0.6) // Default gray
        }
    }
    
    private func drawObjectLabel(_ category: CapturedRoom.Object.Category, at point: CGPoint, context: CGContext) {
        let label = labelForObjectCategory(category)
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 10, weight: .medium),
            .foregroundColor: UIColor.black
        ]
        
        let textSize = label.size(withAttributes: attributes)
        let textRect = CGRect(
            x: point.x - textSize.width / 2,
            y: point.y - textSize.height / 2,
            width: textSize.width,
            height: textSize.height
        )
        
        label.draw(in: textRect, withAttributes: attributes)
    }
    
    private func labelForObjectCategory(_ category: CapturedRoom.Object.Category) -> String {
        switch category {
        case .storage: return "Closet"
        case .refrigerator: return "Fridge"
        case .stove: return "Stove"
        case .bed: return "Bed"
        case .sink: return "Sink"
        case .washerDryer: return "W/D"
        case .toilet: return "Toilet"
        case .bathtub: return "Tub"
        case .oven: return "Oven"
        case .dishwasher: return "DW"
        case .table: return "Table"
        case .sofa: return "Sofa"
        case .chair: return "Chair"
        case .fireplace: return "FP"
        case .television: return "TV"
        case .stairs: return "Stairs"
        @unknown default: return "?"
        }
    }
    
    private func drawDimensions(_ walls: [CapturedRoom.Surface], context: CGContext, scale: CGFloat, offset: CGPoint, bounds: (minX: Float, maxX: Float, minZ: Float, maxZ: Float), alignmentAngle: Float, useMetric: Bool) {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
            .foregroundColor: UIColor.black
        ]
        
        let backgroundAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
            .foregroundColor: UIColor.white,
            .strokeColor: UIColor.white,
            .strokeWidth: -3.0
        ]
        
        for wall in walls {
            let transform = wall.transform
            var position = SIMD3<Float>(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
            let dimensions = wall.dimensions
            
            // Apply alignment rotation to position
            let cosAlign = cos(alignmentAngle)
            let sinAlign = sin(alignmentAngle)
            let rotatedX = position.x * cosAlign - position.z * sinAlign
            let rotatedZ = position.x * sinAlign + position.z * cosAlign
            position.x = rotatedX
            position.z = rotatedZ
            
            // Get wall rotation
            let rotationY = atan2(transform.columns.0.z, transform.columns.0.x) + alignmentAngle
            
            // Calculate offset perpendicular to wall (outside the room)
            // Use wall normal to determine which side is "outside"
            let offsetDistance: Float = 0.15 // 15cm offset from wall (closer)
            
            // Get wall normal (perpendicular direction)
            let normalX = -sin(rotationY)
            let normalZ = cos(rotationY)
            
            // Determine if we need to flip the normal to point outward
            // Check if this position is near the room boundary
            let centerX = (bounds.minX + bounds.maxX) / 2
            let centerZ = (bounds.minZ + bounds.maxZ) / 2
            let toCenter = SIMD2<Float>(centerX - position.x, centerZ - position.z)
            let normal = SIMD2<Float>(normalX, normalZ)
            let dotProduct = toCenter.x * normal.x + toCenter.y * normal.y
            
            // If dot product is positive, normal points inward, so flip it
            let sign: Float = dotProduct > 0 ? -1 : 1
            let perpX = normalX * offsetDistance * sign
            let perpZ = normalZ * offsetDistance * sign
            
            let labelX = position.x + perpX
            let labelZ = position.z + perpZ
            
            let x = CGFloat(labelX) * scale + offset.x
            let z = CGFloat(labelZ) * scale + offset.y
            
            // Draw dimension text
            let widthMeters = dimensions.x
            let text: String
            if useMetric {
                text = String(format: "%.2fm", widthMeters)
            } else {
                let feet = widthMeters * 3.28084
                let feetInt = Int(feet)
                let inches = (feet - Float(feetInt)) * 12
                text = String(format: "%d'%.0f\"", feetInt, inches)
            }
            
            let textSize = text.size(withAttributes: attributes)
            let textRect = CGRect(
                x: x - textSize.width/2,
                y: z - textSize.height/2,
                width: textSize.width,
                height: textSize.height
            )
            
            // Draw white background/outline for readability
            text.draw(in: textRect, withAttributes: backgroundAttributes)
            // Draw black text on top
            text.draw(in: textRect, withAttributes: attributes)
        }
    }
    
    // MARK: - Draw Legend
    
    private func drawLegend(context: CGContext, imageSize: CGSize, hasWindows: Bool, hasDoors: Bool, hasOpenings: Bool) {
        // Position legend in bottom-right corner
        let padding: CGFloat = 20
        let legendWidth: CGFloat = 180
        let lineHeight: CGFloat = 30
        let titleHeight: CGFloat = 35
        
        var items: [(color: UIColor, lineWidth: CGFloat, isDashed: Bool, label: String)] = []
        
        // Add items based on what's present in the floorplan
        items.append((UIColor.black, 4.0, false, "Walls"))
        
        if hasWindows {
            items.append((UIColor.systemBlue, 6.0, false, "Windows"))
        }
        
        if hasDoors {
            items.append((UIColor.systemGreen, 4.0, true, "Doors"))
        }
        
        if hasOpenings {
            items.append((UIColor.systemRed, 5.0, true, "Openings"))
        }
        
        let legendHeight = titleHeight + CGFloat(items.count) * lineHeight + padding * 2
        let legendX = imageSize.width - legendWidth - padding
        let legendY = imageSize.height - legendHeight - padding
        
        // Draw legend background with border
        let legendRect = CGRect(x: legendX, y: legendY, width: legendWidth, height: legendHeight)
        context.setFillColor(UIColor.white.withAlphaComponent(0.95).cgColor)
        context.setStrokeColor(UIColor.black.cgColor)
        context.setLineWidth(1.0)
        context.addRect(legendRect)
        context.drawPath(using: .fillStroke)
        
        // Draw title
        let titleAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 16, weight: .bold),
            .foregroundColor: UIColor.black
        ]
        
        let titleRect = CGRect(
            x: legendX + padding,
            y: legendY + padding,
            width: legendWidth - padding * 2,
            height: 20
        )
        
        "Legend".draw(in: titleRect, withAttributes: titleAttributes)
        
        // Draw legend items
        let lineStartX = legendX + padding
        let lineEndX = lineStartX + 40
        let textStartX = lineEndX + 10
        
        for (index, item) in items.enumerated() {
            let y = legendY + padding + titleHeight + CGFloat(index) * lineHeight + lineHeight / 2
            
            // Draw line sample
            context.setStrokeColor(item.color.cgColor)
            context.setLineWidth(item.lineWidth)
            
            if item.isDashed {
                context.setLineDash(phase: 0, lengths: [8, 4])
            } else {
                context.setLineDash(phase: 0, lengths: [])
            }
            
            context.move(to: CGPoint(x: lineStartX, y: y))
            context.addLine(to: CGPoint(x: lineEndX, y: y))
            context.strokePath()
            
            // Draw label
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 14, weight: .medium),
                .foregroundColor: UIColor.black
            ]
            
            let textRect = CGRect(
                x: textStartX,
                y: y - 10,
                width: legendWidth - (textStartX - legendX) - padding,
                height: 20
            )
            
            item.label.draw(in: textRect, withAttributes: attributes)
        }
        
        // Reset line dash
        context.setLineDash(phase: 0, lengths: [])
    }
    
    // MARK: - Save Floorplan
    
    func saveFloorplan(_ image: UIImage, for scanId: String) throws -> URL {
        let documentsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let floorplansDirectory = documentsDirectory.appendingPathComponent("Floorplans")
        
        // Create directory if needed
        try? FileManager.default.createDirectory(at: floorplansDirectory, withIntermediateDirectories: true)
        
        let fileURL = floorplansDirectory.appendingPathComponent("\(scanId)_floorplan.png")
        
        guard let data = image.pngData() else {
            throw NSError(domain: "FloorplanGenerator", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to convert image to PNG"])
        }
        
        try data.write(to: fileURL)
        print("💾 FloorplanGenerator: Saved floorplan to \(fileURL.path)")
        
        return fileURL
    }
}
