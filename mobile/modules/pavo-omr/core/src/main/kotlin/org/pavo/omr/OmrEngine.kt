package org.pavo.omr

import org.json.JSONArray
import org.json.JSONObject
import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfDouble
import org.opencv.core.MatOfPoint
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point
import org.opencv.core.Rect
import org.opencv.core.Scalar
import org.opencv.core.Size
import org.opencv.imgproc.Imgproc
import org.opencv.objdetect.QRCodeDetector
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Locates a PAVO answer sheet in a photo, corrects perspective and rotation,
 * and measures how dark every bubble is. It never decides what a mark means:
 * classification and grading happen in the shared TypeScript domain.
 */
class OmrEngine(private val template: SheetTemplate, private val debug: ((String) -> Unit)? = null) {

  data class Markers(
    /** Top-left, top-right, bottom-right, bottom-left in source-image pixels. */
    val corners: List<Point>,
    val found: Int,
    val inferred: Boolean,
    val orientationFound: Boolean
  )

  data class Metrics(
    val markersFound: Int,
    val coverage: Double,
    val touchesEdge: Boolean,
    val sharpness: Double,
    val glare: Double,
    val perspective: Double,
    val gridDrift: Double,
    val lightingEvenness: Double
  )

  class Analysis(
    val imageWidth: Int,
    val imageHeight: Int,
    val markers: Markers,
    val metrics: Metrics,
    val rotationDegrees: Double,
    val sheetCode: String?,
    val bubbleFill: List<DoubleArray>,
    val classIdFill: List<DoubleArray>,
    val rowOffsets: List<Point>,
    /** Grayscale sheet in template space (2 px per point), or null when not located. */
    val warped: Mat?
  ) {
    fun toJson(): JSONObject = JSONObject().apply {
      put("imageWidth", imageWidth)
      put("imageHeight", imageHeight)
      put("located", markers.corners.size == 4)
      put("markersFound", markers.found)
      put("inferredMarker", markers.inferred)
      put("orientationFound", markers.orientationFound)
      put("corners", JSONArray(markers.corners.map { JSONObject().put("x", it.x / imageWidth).put("y", it.y / imageHeight) }))
      put("rotationDegrees", rotationDegrees)
      put(
        "metrics",
        JSONObject()
          .put("markersFound", metrics.markersFound)
          .put("coverage", metrics.coverage)
          .put("touchesEdge", metrics.touchesEdge)
          .put("sharpness", metrics.sharpness)
          .put("glare", metrics.glare)
          .put("perspective", metrics.perspective)
          .put("gridDrift", metrics.gridDrift)
          .put("lightingEvenness", metrics.lightingEvenness)
      )
      put("sheetCode", sheetCode ?: JSONObject.NULL)
      put("bubbleFill", JSONArray(bubbleFill.map { row -> JSONArray(row.map { round3(it) }) }))
      put("classIdFill", JSONArray(classIdFill.map { row -> JSONArray(row.map { round3(it) }) }))
      put("rowOffsets", JSONArray(rowOffsets.map { JSONObject().put("x", round3(it.x)).put("y", round3(it.y)) }))
    }
  }

  private data class Candidate(val center: Point, val area: Double, val side: Double)

  /** Full analysis for grading (2 px/pt); `quick` samples a subset for the live auto-capture gate. */
  fun analyze(image: Mat, quick: Boolean = false): Analysis {
    val gray = toGray(image)
    val width = gray.cols()
    val height = gray.rows()
    val factor = min(1.0, WORK_MAX_SIDE / max(width, height).toDouble())
    val work = Mat()
    Imgproc.resize(gray, work, Size(gray.cols() * factor, gray.rows() * factor), 0.0, 0.0, Imgproc.INTER_AREA)
    val workMarkers = detectMarkers(work)
    val markers = workMarkers.copy(corners = workMarkers.corners.map { Point(it.x / factor, it.y / factor) })

    if (markers.corners.size != 4) {
      val sharpness = laplacianVariance(work)
      work.release()
      if (gray !== image) gray.release()
      return Analysis(
        width, height, markers,
        Metrics(markers.found, 0.0, false, sharpness, 0.0, 0.0, 0.0, 0.0),
        0.0, null, emptyList(), emptyList(), emptyList(), null
      )
    }

    val scale = if (quick) 1.0 else SCALE
    val warped = warp(gray, markers.corners, scale)
    val background = paperBackground(warped, odd((template.bubbleRadius * scale * 4.5).roundToInt()))
    val pixels = Pixels(warped, background)

    val rows = if (quick) template.questions.indices.filter { it % 3 == 0 } else template.questions.indices.toList()
    val measuredRows = rows.map { measureGroup(pixels, template.questions[it], template.bubbleRadius, scale) }
    val bubbleFill = if (quick) emptyList() else measuredRows.map { it.first }
    val rowOffsets = measuredRows.map { Point(it.second.x / scale, it.second.y / scale) }
    val classIdFill =
      if (quick) emptyList() else template.classIdBubbles.map { measureGroup(pixels, it, template.classIdRadius, scale).first }
    val sheetCode = if (quick) null else decodeSheetCode(warped, scale)

    val small = if (scale == 1.0) warped else Mat().also { Imgproc.resize(warped, it, Size(), 1.0 / scale, 1.0 / scale, Imgproc.INTER_AREA) }
    val metrics = Metrics(
      markersFound = markers.found,
      coverage = quadArea(workMarkers.corners) / (work.cols().toDouble() * work.rows()),
      touchesEdge = workMarkers.corners.any { corner ->
        val margin = 0.02 * min(work.cols(), work.rows())
        corner.x < margin || corner.y < margin || corner.x > work.cols() - margin || corner.y > work.rows() - margin
      },
      sharpness = laplacianVariance(interior(small, 1.0)),
      glare = glareFraction(interior(small, 1.0)),
      perspective = perspectiveRatio(markers.corners),
      gridDrift = drift(rowOffsets),
      lightingEvenness = lightingEvenness(small)
    )
    if (small !== warped) small.release()
    background.release()
    work.release()
    if (gray !== image) gray.release()
    val keepWarped = if (quick) null else warped
    if (quick) warped.release()
    return Analysis(
      width, height, markers, metrics,
      Math.toDegrees(atan2(markers.corners[1].y - markers.corners[0].y, markers.corners[1].x - markers.corners[0].x)),
      sheetCode, bubbleFill, classIdFill, rowOffsets, keepWarped
    )
  }

  /* ── Marker detection ──────────────────────────────────────────────── */

  private fun detectMarkers(work: Mat): Markers {
    val blurred = Mat()
    Imgproc.GaussianBlur(work, blurred, Size(3.0, 3.0), 0.0)
    val binary = Mat()
    val block = odd(max(31, (min(work.cols(), work.rows()) * 0.08).roundToInt()))
    Imgproc.adaptiveThreshold(blurred, binary, 255.0, Imgproc.ADAPTIVE_THRESH_MEAN_C, Imgproc.THRESH_BINARY_INV, block, 18.0)
    blurred.release()
    val contours = mutableListOf<MatOfPoint>()
    val hierarchy = Mat()
    Imgproc.findContours(binary.clone(), contours, hierarchy, Imgproc.RETR_LIST, Imgproc.CHAIN_APPROX_SIMPLE)
    hierarchy.release()

    val imageArea = work.cols().toDouble() * work.rows()
    val candidates = contours.mapNotNull { contour ->
      val area = Imgproc.contourArea(contour)
      if (area < imageArea * 0.00004 || area > imageArea * 0.02) return@mapNotNull null
      val rect = Imgproc.minAreaRect(MatOfPoint2f(*contour.toArray()))
      val shorter = min(rect.size.width, rect.size.height)
      val longer = max(rect.size.width, rect.size.height)
      if (longer <= 0 || shorter / longer < 0.45 || area / (rect.size.width * rect.size.height) < 0.86) return@mapNotNull null
      if (solidFraction(binary, contour) < 0.85) return@mapNotNull null
      Candidate(rect.center, area, sqrt(area))
    }
    binary.release()
    contours.forEach { it.release() }
    debug?.invoke("candidates: " + candidates.joinToString { "(%.0f,%.0f a=%.0f)".format(it.center.x, it.center.y, it.area) })

    // Corner markers are the largest solid squares on the sheet; the orientation
    // mark and QR finder patterns are a quarter of their area or less.
    val largest = candidates.maxOfOrNull { it.area } ?: 0.0
    val pool = candidates.filter { it.area >= largest * 0.22 }.sortedByDescending { it.area }.take(8)
    val corners = bestCorners(pool, 4) ?: bestCorners(pool, 3)
      ?: return Markers(emptyList(), min(pool.size, 2), false, false)
    debug?.invoke("corners: " + corners.joinToString { "(%.0f,%.0f)".format(it.center.x, it.center.y) })
    val markerArea = corners.map { it.area }.sorted()[corners.size / 2]
    var points = corners.map { it.center }
    val inferred = points.size == 3
    if (inferred) points = completeParallelogram(points)
    val ordered = clockwise(points)
    // Compare the orientation mark with the corner marker beside it, since perspective
    // can make near and far markers very different sizes.
    val orientation = candidates
      .filter { it !in corners }
      .mapNotNull { candidate ->
        val nearest = corners.minBy { distance(it.center, candidate.center) }
        val gap = distance(nearest.center, candidate.center)
        if (candidate.area / nearest.area in 0.15..0.45 && gap < 3.2 * sqrt(nearest.area)) candidate to gap else null
      }
      .minByOrNull { it.second }
      ?.first
      ?: return Markers(emptyList(), corners.size, inferred, false)
    val topLeftIndex = ordered.indices.minBy { hypot(ordered[it].x - orientation.center.x, ordered[it].y - orientation.center.y) }
    var result = (0 until 4).map { ordered[(topLeftIndex + it) % 4] }
    val alongTop = projection(orientation.center, result[0], result[1])
    val alongLeft = projection(orientation.center, result[0], result[3])
    if (alongLeft > alongTop) result = listOf(result[0], result[3], result[2], result[1])
    debug?.invoke("ordered: " + result.joinToString { "(%.0f,%.0f)".format(it.x, it.y) } + " orientation=" + orientation.center)
    if (!plausibleSheet(result, sqrt(markerArea))) return Markers(emptyList(), corners.size, inferred, true)
    return Markers(result, if (inferred) 3 else 4, inferred, true)
  }

  private fun bestCorners(pool: List<Candidate>, count: Int): List<Candidate>? {
    var best: List<Candidate>? = null
    var bestArea = 0.0
    combinations(pool.size, count) { indices ->
      val chosen = indices.map { pool[it] }
      val areas = chosen.map { it.area }
      if (areas.max() / areas.min() > 5.0) return@combinations
      val points = if (count == 4) clockwise(chosen.map { it.center }) else completeParallelogram(chosen.map { it.center })
      val area = quadArea(clockwise(points))
      if (area > bestArea && plausibleSheet(clockwise(points), sqrt(areas.sorted()[count / 2]))) {
        bestArea = area
        best = chosen
      }
    }
    return best
  }

  /** Marker size and aspect ratio must resemble the printed layout. */
  private fun plausibleSheet(corners: List<Point>, markerSide: Double): Boolean {
    val top = distance(corners[0], corners[1])
    val bottom = distance(corners[3], corners[2])
    val left = distance(corners[0], corners[3])
    val right = distance(corners[1], corners[2])
    val width = (top + bottom) / 2
    val height = (left + right) / 2
    if (width <= 0 || height <= 0) return false
    val expectedAspect = distance(template.markerCenters[0], template.markerCenters[1]) /
      distance(template.markerCenters[0], template.markerCenters[3])
    val aspect = min(width, height) / max(width, height)
    val expected = min(expectedAspect, 1 / expectedAspect)
    val markerRatio = markerSide / min(width, height)
    val expectedMarkerRatio = template.markerSize / min(
      distance(template.markerCenters[0], template.markerCenters[1]),
      distance(template.markerCenters[0], template.markerCenters[3])
    )
    val anglesPlausible = corners.indices.all { index ->
      val corner = corners[index]
      val previous = corners[(index + 3) % 4]
      val next = corners[(index + 1) % 4]
      val a = Point(previous.x - corner.x, previous.y - corner.y)
      val b = Point(next.x - corner.x, next.y - corner.y)
      val cosine = (a.x * b.x + a.y * b.y) / (hypot(a.x, a.y) * hypot(b.x, b.y))
      Math.toDegrees(kotlin.math.acos(cosine.coerceIn(-1.0, 1.0))) in 50.0..130.0
    }
    return anglesPlausible && aspect / expected in 0.6..1.6 && markerRatio / expectedMarkerRatio in 0.5..2.0
  }

  /* ── Measurement ───────────────────────────────────────────────────── */

  private class Pixels(gray: Mat, background: Mat) {
    val width = gray.cols()
    val height = gray.rows()
    private val grayBytes = ByteArray(width * height).also { gray.get(0, 0, it) }
    private val backgroundBytes = ByteArray(width * height).also { background.get(0, 0, it) }

    /** 0 = as bright as the surrounding paper, 1 = black. */
    fun darkness(x: Int, y: Int): Double {
      if (x < 0 || y < 0 || x >= width || y >= height) return 0.0
      val index = y * width + x
      val paper = max(1, backgroundBytes[index].toInt() and 0xff)
      val value = grayBytes[index].toInt() and 0xff
      return (1.0 - value.toDouble() / paper).coerceIn(0.0, 1.0)
    }
  }

  /** Aligns a row of bubbles to its printed outlines, then measures each interior. */
  private fun measureGroup(pixels: Pixels, centers: List<Point>, radiusPt: Double, scale: Double): Pair<DoubleArray, Point> {
    val radius = radiusPt * scale
    val ring = circle(radius, 32)
    val outside = circle(radius * 1.45, 32)
    val search = max(1, (radius * 0.85).roundToInt())
    var bestOffset = Point(0.0, 0.0)
    var bestScore = Double.NEGATIVE_INFINITY
    for (dy in -search..search) {
      for (dx in -search..search) {
        var score = 0.0
        for (center in centers) {
          val cx = center.x * scale + dx
          val cy = center.y * scale + dy
          score += ring.sumOf { pixels.darkness((cx + it.x).roundToInt(), (cy + it.y).roundToInt()) } -
            0.5 * outside.sumOf { pixels.darkness((cx + it.x).roundToInt(), (cy + it.y).roundToInt()) }
        }
        if (score > bestScore + 1e-9 || (abs(score - bestScore) < 1e-9 && hypot(dx.toDouble(), dy.toDouble()) < hypot(bestOffset.x, bestOffset.y))) {
          bestScore = score
          bestOffset = Point(dx.toDouble(), dy.toDouble())
        }
      }
    }
    val inner = radius * INNER_RADIUS
    val span = inner.toInt() + 1
    val fills = DoubleArray(centers.size) { index ->
      val cx = centers[index].x * scale + bestOffset.x
      val cy = centers[index].y * scale + bestOffset.y
      var ink = 0.0
      var total = 0
      for (oy in -span..span) {
        for (ox in -span..span) {
          if (ox * ox + oy * oy > inner * inner) continue
          total += 1
          val darkness = pixels.darkness((cx + ox).roundToInt(), (cy + oy).roundToInt())
          ink += ((darkness - INK_FLOOR) / (INK_FULL - INK_FLOOR)).coerceIn(0.0, 1.0)
        }
      }
      if (total == 0) 0.0 else ink / total
    }
    return fills to bestOffset
  }

  private fun decodeSheetCode(warped: Mat, scale: Double): String? {
    val margin = 8 * scale
    val x = max(0.0, template.sheetCodeX * scale - margin)
    val y = max(0.0, template.sheetCodeY * scale - margin)
    val size = template.sheetCodeSize * scale + 2 * margin
    val rect = Rect(x.toInt(), y.toInt(), min(size, warped.cols() - x).toInt(), min(size, warped.rows() - y).toInt())
    val roi = warped.submat(rect)
    val detector = QRCodeDetector()
    var text = detector.detectAndDecode(roi)
    if (text.isNullOrEmpty()) {
      val binary = Mat()
      Imgproc.threshold(roi, binary, 0.0, 255.0, Imgproc.THRESH_BINARY or Imgproc.THRESH_OTSU)
      text = detector.detectAndDecode(binary)
      binary.release()
    }
    roi.release()
    return text?.takeIf { it.isNotEmpty() }
  }

  private fun warp(gray: Mat, corners: List<Point>, scale: Double): Mat {
    val source = MatOfPoint2f(*corners.toTypedArray())
    val target = MatOfPoint2f(*template.markerCenters.map { Point(it.x * scale, it.y * scale) }.toTypedArray())
    val transform = Imgproc.getPerspectiveTransform(source, target)
    val warped = Mat()
    Imgproc.warpPerspective(
      gray, warped, transform,
      Size(template.pageWidth * scale, template.pageHeight * scale),
      Imgproc.INTER_LINEAR, Core.BORDER_CONSTANT, Scalar(255.0)
    )
    source.release()
    target.release()
    transform.release()
    return warped
  }

  /* ── Metrics ───────────────────────────────────────────────────────── */

  private fun paperBackground(gray: Mat, kernel: Int): Mat {
    val background = Mat()
    val element = Imgproc.getStructuringElement(Imgproc.MORPH_ELLIPSE, Size(kernel.toDouble(), kernel.toDouble()))
    Imgproc.morphologyEx(gray, background, Imgproc.MORPH_CLOSE, element)
    Imgproc.GaussianBlur(background, background, Size(kernel.toDouble(), kernel.toDouble()), 0.0)
    element.release()
    return background
  }

  /** Page area inside the markers, excluding the marker band. */
  private fun interior(sheet: Mat, scale: Double): Mat {
    val inset = ((template.markerCenters[0].x + template.markerSize) * scale).toInt()
    return sheet.submat(Rect(inset, inset, sheet.cols() - 2 * inset, sheet.rows() - 2 * inset))
  }

  private fun laplacianVariance(gray: Mat): Double {
    val laplacian = Mat()
    Imgproc.Laplacian(gray, laplacian, CvType.CV_64F)
    val mean = MatOfDouble()
    val deviation = MatOfDouble()
    Core.meanStdDev(laplacian, mean, deviation)
    laplacian.release()
    return deviation.toArray()[0].let { it * it }
  }

  private fun glareFraction(gray: Mat): Double {
    val bright = Mat()
    Imgproc.threshold(gray, bright, 249.0, 1.0, Imgproc.THRESH_BINARY)
    val fraction = Core.sumElems(bright).`val`[0] / (gray.cols().toDouble() * gray.rows())
    bright.release()
    return fraction
  }

  private fun lightingEvenness(sheet: Mat): Double {
    val region = interior(sheet, 1.0)
    val background = paperBackground(region, 41)
    val values = ByteArray(background.cols() * background.rows()).also { background.get(0, 0, it) }
      .map { it.toInt() and 0xff }
      .sorted()
    background.release()
    if (values.isEmpty()) return 0.0
    val low = values[(values.size * 0.05).toInt()]
    val high = values[(values.size * 0.95).toInt().coerceAtMost(values.size - 1)]
    return if (high == 0) 0.0 else low.toDouble() / high
  }

  /* ── Geometry helpers ──────────────────────────────────────────────── */

  private fun toGray(image: Mat): Mat = when (image.channels()) {
    1 -> image
    3 -> Mat().also { Imgproc.cvtColor(image, it, Imgproc.COLOR_BGR2GRAY) }
    4 -> Mat().also { Imgproc.cvtColor(image, it, Imgproc.COLOR_BGRA2GRAY) }
    else -> throw IllegalArgumentException("Unsupported image format.")
  }

  private fun solidFraction(binary: Mat, contour: MatOfPoint): Double {
    val box = Imgproc.boundingRect(contour)
    val mask = Mat.zeros(box.height, box.width, CvType.CV_8U)
    Imgproc.drawContours(mask, listOf(contour), -1, Scalar(255.0), -1, Imgproc.LINE_8, Mat(), Int.MAX_VALUE, Point(-box.x.toDouble(), -box.y.toDouble()))
    val roi = binary.submat(box)
    val fraction = Core.mean(roi, mask).`val`[0] / 255.0
    roi.release()
    mask.release()
    return fraction
  }

  private fun clockwise(points: List<Point>): List<Point> {
    val cx = points.sumOf { it.x } / points.size
    val cy = points.sumOf { it.y } / points.size
    return points.sortedBy { atan2(it.y - cy, it.x - cx) }
  }

  /** Completes a rectangle from three corners: the missing one is opposite the corner off the diagonal. */
  private fun completeParallelogram(points: List<Point>): List<Point> {
    val pairs = listOf(0 to 1, 0 to 2, 1 to 2)
    val (a, c) = pairs.maxBy { (i, j) -> distance(points[i], points[j]) }
    val b = 3 - a - c
    return points + Point(points[a].x + points[c].x - points[b].x, points[a].y + points[c].y - points[b].y)
  }

  private fun perspectiveRatio(corners: List<Point>): Double {
    val top = distance(corners[0], corners[1])
    val bottom = distance(corners[3], corners[2])
    val left = distance(corners[0], corners[3])
    val right = distance(corners[1], corners[2])
    return min(min(top, bottom) / max(top, bottom), min(left, right) / max(left, right))
  }

  /** How far printed rows sit from where the flat-sheet homography puts them, in points. */
  private fun drift(offsets: List<Point>): Double = offsets.maxOfOrNull { hypot(it.x, it.y) } ?: 0.0

  private fun projection(point: Point, origin: Point, toward: Point): Double {
    val length = distance(origin, toward)
    if (length == 0.0) return 0.0
    return abs(((point.x - origin.x) * (toward.x - origin.x) + (point.y - origin.y) * (toward.y - origin.y)) / length)
  }

  private fun quadArea(points: List<Point>): Double {
    if (points.size < 3) return 0.0
    var sum = 0.0
    for (index in points.indices) {
      val current = points[index]
      val next = points[(index + 1) % points.size]
      sum += current.x * next.y - next.x * current.y
    }
    return abs(sum) / 2
  }

  private fun circle(radius: Double, samples: Int): List<Point> =
    (0 until samples).map { val angle = 2 * Math.PI * it / samples; Point(radius * cos(angle), radius * sin(angle)) }

  private fun combinations(size: Int, count: Int, visit: (IntArray) -> Unit) {
    if (size < count) return
    val indices = IntArray(count) { it }
    while (true) {
      visit(indices)
      var position = count - 1
      while (position >= 0 && indices[position] == size - count + position) position -= 1
      if (position < 0) return
      indices[position] += 1
      for (next in position + 1 until count) indices[next] = indices[next - 1] + 1
    }
  }

  companion object {
    /** Template points to pixels in the warped grading image. */
    const val SCALE = 2.0
    private const val WORK_MAX_SIDE = 1400.0
    private const val INNER_RADIUS = 0.62

    /**
     * Ink ramp relative to local paper brightness: below the floor is paper
     * texture, at or above "full" is a confident shade. Faint pencil and
     * erasure residue land in between instead of snapping to blank.
     */
    private const val INK_FLOOR = 0.08
    private const val INK_FULL = 0.55

    private fun distance(a: Point, b: Point) = hypot(a.x - b.x, a.y - b.y)
    private fun odd(value: Int) = if (value % 2 == 0) value + 1 else value
    private fun round3(value: Double) = (value * 1000).roundToInt() / 1000.0
  }
}
