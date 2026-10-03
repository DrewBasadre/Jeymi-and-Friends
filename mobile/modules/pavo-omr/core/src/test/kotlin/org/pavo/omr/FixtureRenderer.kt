package org.pavo.omr

import org.json.JSONObject
import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfByte
import org.opencv.core.MatOfInt
import org.opencv.core.MatOfPoint
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point
import org.opencv.core.Scalar
import org.opencv.core.Size
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.imgproc.Imgproc
import java.util.Random
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.roundToInt
import kotlin.math.sin

/** Renders original PAVO answer sheets and emulates phone photos of them. */
object FixtureRenderer {
  private const val S = 2.0
  private const val PAPER = 234.0
  private const val INK = 24.0

  fun renderSheet(template: SheetTemplate, fixture: JSONObject, random: Random): Mat {
    val page = Mat((template.pageHeight * S).roundToInt(), (template.pageWidth * S).roundToInt(), CvType.CV_8UC1, Scalar(PAPER))
    val transform = fixture.getJSONObject("transform")

    template.markerCenters.forEachIndexed { index, center ->
      square(page, center, template.markerSize, INK)
      if (index == 2 && transform.optString("occludeMarker") == "BR") {
        val half = template.markerSize / 2
        Imgproc.rectangle(
          page,
          Point((center.x - half - 3) * S, (center.y - half - 3) * S),
          Point((center.x - half + template.markerSize * 0.7) * S, (center.y + half + 3) * S),
          Scalar(226.0), -1
        )
      }
    }
    square(page, template.orientationCenter, template.orientationSize, INK)

    text(page, "PAVO ANSWER SHEET", 50.0, 72.0, 0.9, 2)
    text(page, "Fixture quiz - Form A", 50.0, 92.0, 0.6, 1)
    text(page, "Name  ____________________", 50.0, 148.0, 0.6, 1)

    val modules = fixture.getJSONArray("qrModules")
    val count = modules.length()
    val cell = template.sheetCodeSize / (count + 2)
    for (row in 0 until count) {
      val line = modules.getString(row)
      for (column in 0 until count) {
        if (line[column] == '1') {
          val x = template.sheetCodeX + cell * (column + 1)
          val y = template.sheetCodeY + cell * (row + 1)
          Imgproc.rectangle(page, Point(x * S, y * S), Point((x + cell) * S - 1, (y + cell) * S - 1), Scalar(INK), -1)
        }
      }
    }

    template.questions.forEachIndexed { index, bubbles ->
      text(page, "${index + 1}", bubbles[0].x - template.bubbleRadius - 16, bubbles[0].y + 3, 0.45, 1)
      bubbles.forEach { outline(page, it, template.bubbleRadius) }
    }
    val classId = fixture.getJSONArray("classId")
    template.classIdBubbles.forEachIndexed { digit, column ->
      column.forEachIndexed { value, center ->
        outline(page, center, template.classIdRadius)
        if (digit < classId.length() && classId.getInt(digit) == value) {
          Imgproc.circle(page, scaled(center), (template.classIdRadius * 0.95 * S).roundToInt(), Scalar(INK), -1, Imgproc.LINE_AA)
        }
      }
    }

    val marks = fixture.getJSONArray("marks")
    for (index in 0 until marks.length()) {
      val mark = marks.getJSONObject(index)
      val center = template.questions[mark.getInt("question") - 1][mark.getInt("choice")]
      drawMark(page, center, template.bubbleRadius, mark.getString("style"), random)
    }
    return page
  }

  private fun drawMark(page: Mat, center: Point, radiusPt: Double, style: String, random: Random) {
    val radius = radiusPt * S
    val jitter = Point(center.x * S + random.nextGaussian() * radius * 0.05, center.y * S + random.nextGaussian() * radius * 0.05)
    when (style) {
      "solid" -> Imgproc.circle(page, jitter, (radius * 0.96).roundToInt(), Scalar(30.0), -1, Imgproc.LINE_AA)
      "pencil" -> {
        Imgproc.circle(page, jitter, (radius * 0.97).roundToInt(), Scalar(104.0), -1, Imgproc.LINE_AA)
        repeat(6) {
          val angle = random.nextDouble() * PI
          val length = radius * 0.8
          Imgproc.line(
            page,
            Point(jitter.x - cos(angle) * length, jitter.y - sin(angle) * length),
            Point(jitter.x + cos(angle) * length, jitter.y + sin(angle) * length),
            Scalar(132.0), 1, Imgproc.LINE_AA
          )
        }
      }
      "faint" -> Imgproc.circle(page, jitter, (radius * 0.85).roundToInt(), Scalar(176.0), -1, Imgproc.LINE_AA)
      "erasure" -> Imgproc.ellipse(page, jitter, Size(radius * 0.95, radius * 0.8), 20.0, 0.0, 360.0, Scalar(190.0), -1, Imgproc.LINE_AA)
      "dot" -> Imgproc.circle(page, jitter, (radius * 0.35).roundToInt(), Scalar(30.0), -1, Imgproc.LINE_AA)
      "check" -> {
        val points = listOf(Point(-0.6, 0.0), Point(-0.15, 0.55), Point(0.75, -0.7))
          .map { Point(jitter.x + it.x * radius, jitter.y + it.y * radius) }
        Imgproc.polylines(page, listOf(MatOfPoint(*points.toTypedArray())), false, Scalar(40.0), 3, Imgproc.LINE_AA)
      }
      else -> throw IllegalArgumentException("Unknown mark style $style")
    }
  }

  /** Places the sheet on a table, then applies camera-like degradations. */
  fun photograph(page: Mat, transform: JSONObject, seed: Long): Mat {
    Core.setRNGSeed(seed.toInt())
    val width = 1500
    val height = 2000
    val canvas = Mat(height, width, CvType.CV_8UC1, Scalar(108.0))
    addNoise(canvas, 9.0)

    var source = page
    val curl = transform.optDouble("curl", 0.0)
    if (curl > 0) source = curlPage(page, curl)

    val scale = transform.optDouble("scale", 0.9)
    val sheetHeight = height * 0.95 * scale
    val sheetWidth = sheetHeight * page.cols() / page.rows()
    val centerX = width / 2.0 + transform.optDouble("shiftX", 0.0) * width
    val centerY = height / 2.0
    val perspective = transform.optDouble("perspective", 0.0)
    var corners = listOf(
      Point(centerX - sheetWidth / 2 * (1 - perspective), centerY - sheetHeight / 2 * (1 - perspective * 0.25)),
      Point(centerX + sheetWidth / 2 * (1 - perspective), centerY - sheetHeight / 2 * (1 - perspective * 0.25)),
      Point(centerX + sheetWidth / 2, centerY + sheetHeight / 2),
      Point(centerX - sheetWidth / 2, centerY + sheetHeight / 2)
    )
    val tilt = Math.toRadians(transform.optDouble("tilt", 0.0))
    if (tilt != 0.0) {
      corners = corners.map {
        val dx = it.x - centerX
        val dy = it.y - centerY
        Point(centerX + dx * cos(tilt) - dy * sin(tilt), centerY + dx * sin(tilt) + dy * cos(tilt))
      }
    }
    val pageCorners = listOf(
      Point(0.0, 0.0), Point(page.cols().toDouble(), 0.0),
      Point(page.cols().toDouble(), page.rows().toDouble()), Point(0.0, page.rows().toDouble())
    )
    val matrix = Imgproc.getPerspectiveTransform(MatOfPoint2f(*pageCorners.toTypedArray()), MatOfPoint2f(*corners.toTypedArray()))
    val warped = Mat()
    Imgproc.warpPerspective(source, warped, matrix, Size(width.toDouble(), height.toDouble()), Imgproc.INTER_LINEAR, Core.BORDER_CONSTANT, Scalar(0.0))
    val mask = Mat()
    Imgproc.warpPerspective(
      Mat(page.rows(), page.cols(), CvType.CV_8UC1, Scalar(255.0)), mask, matrix,
      Size(width.toDouble(), height.toDouble()), Imgproc.INTER_NEAREST, Core.BORDER_CONSTANT, Scalar(0.0)
    )
    warped.copyTo(canvas, mask)

    val photo = Mat()
    canvas.convertTo(photo, CvType.CV_32F)
    val lighting = transform.optDouble("lighting", 0.0)
    val shadow = transform.optDouble("shadow", 0.0)
    if (lighting > 0 || shadow > 0) {
      val gain = Mat(height, width, CvType.CV_32F)
      val shadowMask = Mat.zeros(height, width, CvType.CV_32F)
      if (shadow > 0) {
        Imgproc.fillPoly(
          shadowMask,
          listOf(MatOfPoint(Point(0.0, height * 0.45), Point(width * 0.7, height.toDouble()), Point(0.0, height.toDouble()))),
          Scalar(1.0)
        )
        Imgproc.GaussianBlur(shadowMask, shadowMask, Size(0.0, 0.0), 30.0)
      }
      val row = FloatArray(width)
      for (y in 0 until height) {
        val shade = FloatArray(width).also { shadowMask.get(y, 0, it) }
        for (x in 0 until width) {
          row[x] = ((1 - lighting * x / width) * (1 - shadow * shade[x])).toFloat()
        }
        gain.put(y, 0, row)
      }
      Core.multiply(photo, gain, photo)
    }
    if (transform.optBoolean("glare", false)) {
      val glare = Mat(height, width, CvType.CV_32F)
      val row = FloatArray(width)
      for (y in 0 until height) {
        for (x in 0 until width) {
          val dx = (x - width * 0.62) / (width * 0.16)
          val dy = (y - height * 0.5) / (height * 0.1)
          row[x] = (330 * exp(-(dx * dx + dy * dy))).toFloat()
        }
        glare.put(y, 0, row)
      }
      Core.add(photo, glare, photo)
    }
    photo.convertTo(canvas, CvType.CV_8UC1)

    val blur = transform.optDouble("blur", 0.0)
    if (blur > 0) Imgproc.GaussianBlur(canvas, canvas, Size(0.0, 0.0), blur)
    addNoise(canvas, transform.optDouble("noise", 0.0))

    when (transform.optInt("rotate", 0)) {
      90 -> Core.rotate(canvas, canvas, Core.ROTATE_90_CLOCKWISE)
      180 -> Core.rotate(canvas, canvas, Core.ROTATE_180)
      270 -> Core.rotate(canvas, canvas, Core.ROTATE_90_COUNTERCLOCKWISE)
    }
    val quality = transform.optInt("jpegQuality", 0)
    if (quality > 0) {
      val buffer = MatOfByte()
      Imgcodecs.imencode(".jpg", canvas, buffer, MatOfInt(Imgcodecs.IMWRITE_JPEG_QUALITY, quality))
      return Imgcodecs.imdecode(buffer, Imgcodecs.IMREAD_GRAYSCALE)
    }
    return canvas
  }

  /** Bends the sheet so its middle rises like curled paper. */
  private fun curlPage(page: Mat, amplitude: Double): Mat {
    val mapX = Mat(page.rows(), page.cols(), CvType.CV_32F)
    val mapY = Mat(page.rows(), page.cols(), CvType.CV_32F)
    val rowX = FloatArray(page.cols())
    val rowY = FloatArray(page.cols())
    for (y in 0 until page.rows()) {
      for (x in 0 until page.cols()) {
        rowX[x] = x.toFloat()
        rowY[x] = (y + amplitude * sin(PI * x / page.cols()) * sin(PI * y / page.rows())).toFloat()
      }
      mapX.put(y, 0, rowX)
      mapY.put(y, 0, rowY)
    }
    val curled = Mat()
    Imgproc.remap(page, curled, mapX, mapY, Imgproc.INTER_LINEAR, Core.BORDER_CONSTANT, Scalar(PAPER))
    return curled
  }

  private fun addNoise(image: Mat, sigma: Double) {
    if (sigma <= 0) return
    val noise = Mat(image.size(), CvType.CV_16SC1)
    Core.randn(noise, 0.0, sigma)
    val wide = Mat()
    image.convertTo(wide, CvType.CV_16SC1)
    Core.add(wide, noise, wide)
    wide.convertTo(image, CvType.CV_8UC1)
  }

  private fun square(page: Mat, center: Point, size: Double, color: Double) {
    val half = size / 2
    Imgproc.rectangle(page, Point((center.x - half) * S, (center.y - half) * S), Point((center.x + half) * S, (center.y + half) * S), Scalar(color), -1)
  }

  private fun outline(page: Mat, center: Point, radius: Double) {
    Imgproc.circle(page, scaled(center), (radius * S).roundToInt(), Scalar(56.0), 2, Imgproc.LINE_AA)
  }

  private fun text(page: Mat, value: String, x: Double, y: Double, size: Double, weight: Int) {
    Imgproc.putText(page, value, Point(x * S, y * S), Imgproc.FONT_HERSHEY_SIMPLEX, size, Scalar(INK), weight, Imgproc.LINE_AA)
  }

  private fun scaled(point: Point) = Point(point.x * S, point.y * S)
}
