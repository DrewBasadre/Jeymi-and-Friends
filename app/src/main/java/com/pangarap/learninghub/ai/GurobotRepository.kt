package com.pangarap.learninghub.ai

import com.pangarap.learninghub.BuildConfig
import com.pangarap.learninghub.data.local.QuizAttemptEntity
import com.pangarap.learninghub.domain.GurobotInput
import com.pangarap.learninghub.domain.GurobotResponse
import com.pangarap.learninghub.domain.RecordBookRow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class GurobotRepository {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun generate(input: GurobotInput): GurobotResponse {
        val apiKey = BuildConfig.GEMINI_API_KEY.trim()
        if (apiKey.isBlank()) {
            return GurobotResponse(mockLesson(input), "Offline draft: Gemini API key missing")
        }
        return runCatching {
            requestGemini(apiKey, input)
        }.getOrElse {
            GurobotResponse(mockLesson(input), "Offline draft: Gemini unavailable (${it.geminiFailureDetail()})")
        }
    }

    suspend fun assessStudent(row: RecordBookRow, attempts: List<QuizAttemptEntity>): String {
        val apiKey = BuildConfig.GEMINI_API_KEY.trim()
        val attemptSummary = attempts.take(8).joinToString("\n") {
            "- ${it.moduleId}: ${it.score}/${it.totalItems}, mastery ${it.masteryLevel}, weak topic ${it.weakTopic}, time ${it.durationSeconds}s"
        }.ifBlank { "- No scanned quiz attempts yet" }
        val prompt = """
            You are Gurobot, a teacher co-pilot for a Philippine class.
            Analyze this student record using the scanned quiz evidence and suggest concise, practical teacher actions.
            $CONTENT_STYLE_RULES

            Student: ${row.lastName}, ${row.firstName} ${row.middleInitial}
            Grade ${row.gradeLevel} - ${row.section}
            Average: ${row.averageScore}%
            Completion: ${row.completedModules}/${row.totalModules}
            Current weak topic: ${row.weakTopic}
            Attempts:
            $attemptSummary

            Return only these sections. Keep the language teacher-friendly and actionable:
            1. Performance pattern
            2. Likely learning need
            3. Three teacher actions for the next week, with one low-resource activity
            4. Monitoring plan with a measurable success indicator
            5. One parent/guardian note in plain language

            Keep each section to 1-2 short sentences. Do not diagnose the learner. Do not mention private data beyond the supplied school record.
        """.trimIndent()
        if (apiKey.isBlank()) return offlineAssessment(row, attempts, "Gemini API key missing")
        return runCatching { requestGeminiText(apiKey, prompt) }
            .getOrElse { offlineAssessment(row, attempts, it.geminiFailureDetail()) }
            .ifBlank { offlineAssessment(row, attempts, "Gemini returned no text") }
    }

    private suspend fun requestGemini(apiKey: String, input: GurobotInput): GurobotResponse = withContext(Dispatchers.IO) {
        val prompt = """
            You are Gurobot, a teacher co-pilot for a Philippine Grade ${input.gradeLevel} class.
            Subject: ${input.subject}
            Lesson name: ${input.competencyCode}
            Quarter: ${input.quarter}
            Module number: ${input.moduleNumber}
            Topic: ${input.topic}
            Teacher request: ${input.action}

            Generate a practical, low-resource lesson package aligned to the lesson name and topic.
            The output should be ready for a teacher to save and share as an additional module.
            Keep it age-appropriate for Grade ${input.gradeLevel}, locally contextualized, and suitable for offline use.
            $CONTENT_STYLE_RULES
            Start directly with the first heading. Do not add an introduction.
            Use plain heading text only, with no Markdown symbols like # or ###.

            Use these headings only:
            Objectives
            Key Idea
            Materials
            Daily Lesson Log
            Learner Activity Sheet
            Differentiation
            Assessment
            Remediation
            Teacher Notes

            Requirements:
            - Keep the whole draft around 650 to 900 words.
            - For a simple topic, stay closer to 650 words. For a broad topic, add a little more detail.
            - Use 2 to 4 short bullets or short sentences under most headings.
            - Objectives must be observable and measurable.
            - Daily Lesson Log must include motivation, presentation, guided practice, independent practice, and closure.
            - Learner Activity Sheet must include student-facing directions and 3 to 5 short tasks.
            - Differentiation must include support, core, and extension options.
            - Assessment must include 5 quick items and a short answer key or expected responses.
            - Remediation must target the most likely misconception with a short activity.
            - Give enough detail for a 30 to 45 minute lesson, but keep every sentence easy to read.
            - Complete every heading and never end in the middle of a sentence.
            - Stop after Teacher Notes. Do not add extra sections.
            - Do not include student private data.
        """.trimIndent()
        val text = requestGeminiText(apiKey, prompt)
        if (text.isBlank()) {
            GurobotResponse(mockLesson(input), "Offline draft generated")
        } else {
            GurobotResponse(text, "Gemini draft generated")
        }
    }

    private suspend fun requestGeminiText(apiKey: String, prompt: String): String = withContext(Dispatchers.IO) {
        val body = """
            {
              "contents": [{"parts": [{"text": ${json.encodeToString(prompt)}}]}],
              "generationConfig": {
                "temperature": 0.35,
                "topP": 0.9,
                "maxOutputTokens": 4096,
                "thinkingConfig": {
                  "thinkingBudget": 0
                }
              }
            }
        """.trimIndent()
        val url = URL("https://generativelanguage.googleapis.com/v1beta/models/$GEMINI_MODEL:generateContent?key=$apiKey")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 12_000
            readTimeout = 20_000
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
        }
        OutputStreamWriter(connection.outputStream).use { it.write(body) }
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val response = stream.bufferedReader().use { it.readText() }
        if (connection.responseCode !in 200..299) {
            throw GeminiRequestException(parseGeminiError(connection.responseCode, response))
        }
        val text = json.parseToJsonElement(response)
            .jsonObject["candidates"]?.jsonArray?.firstOrNull()
            ?.jsonObject?.get("content")?.jsonObject?.get("parts")?.jsonArray?.firstOrNull()
            ?.jsonObject?.get("text")?.jsonPrimitive?.content
            .orEmpty()
        if (text.isBlank()) {
            throw GeminiRequestException("Gemini returned no text")
        }
        text
    }

    private fun parseGeminiError(responseCode: Int, response: String): String {
        return runCatching {
            val error = json.parseToJsonElement(response).jsonObject["error"]?.jsonObject
            val status = error?.get("status")?.jsonPrimitive?.content
            val message = error?.get("message")?.jsonPrimitive?.content
            listOfNotNull("Gemini HTTP $responseCode", status, message).joinToString(": ")
        }.getOrDefault("Gemini HTTP $responseCode")
    }

    private fun mockLesson(input: GurobotInput): String {
        val actionNote = when (input.action) {
            "Make it easier" -> "Use simpler vocabulary, real classroom objects, and shorter learner responses."
            "Add group activity" -> "Learners work in small groups with assigned reporter, recorder, and materials manager."
            "Add formative quiz" -> "End with a five-item check using true/false and identification questions."
            "Add low-resource version" -> "Use paper, board work, reusable objects, and oral sharing instead of printed materials."
            "Add intervention activity" -> "Give struggling learners a guided example before independent practice."
            else -> "Use a balanced lesson flow that moves from concrete examples to learner explanation."
        }
        return """
            Objectives:
            - Explain ${input.topic} in simple words.
            - Give one real-life example.
            - Answer a short check-up task.

            Key Idea:
            ${input.topic} is easier to learn when students use simple examples and explain their answer in their own words.

            Materials:
            - Board or manila paper
            - Notebook
            - One classroom object or local example

            Daily Lesson Log:
            - Motivation: Ask one familiar question about ${input.topic}.
            - Presentation: Explain the key idea with one example.
            - Guided practice: Let pairs answer one sample item.
            - Independent practice: Let each learner answer two short items.
            - Closure: Ask one learner to say the main idea.

            Learner Activity Sheet:
            - Task 1: Write the key idea in one sentence.
            - Task 2: Give one example.
            - Task 3: Explain why your example fits.

            Differentiation:
            - Support: Use sentence starters and one worked example.
            - Core: Let learners answer the main activity independently.
            - Extension: Ask learners to make a new example.

            Assessment:
            - Exit check: three short questions.
            - Expected result: learners answer at least two correctly.

            Remediation:
            - $actionNote

            Teacher Notes:
            Keep sentences short. Use examples that 10-year-olds see at home or in school.
        """.trimIndent()
    }

    private fun offlineAssessment(row: RecordBookRow, attempts: List<QuizAttemptEntity>, reason: String? = null): String {
        val pattern = when {
            row.averageScore >= 90.0 -> "1. Performance pattern: The learner is consistently advanced and ready for enrichment."
            row.averageScore >= 80.0 -> "1. Performance pattern: The learner is generally proficient with a few topics to strengthen."
            row.averageScore >= 70.0 -> "1. Performance pattern: The learner is developing and needs guided practice before independent tasks."
            else -> "1. Performance pattern: The learner needs focused intervention and closer monitoring."
        }
        val slowAttempts = attempts.count { it.durationSeconds > 420 }
        val fallbackNote = reason?.let { "Gemini unavailable: $it\n\n" }.orEmpty()
        return """
            $fallbackNote
            $pattern
            2. Likely learning need: ${row.weakTopic}. ${if (slowAttempts > 0) "Some attempts took longer than expected, so check confidence and reading load." else "Use short checks to confirm the misconception."}
            3. Three teacher actions for the next week: reteach with one concrete example; pair the learner with a peer coach for practice; give a five-item exit check after remediation.
            4. Monitoring plan with a measurable success indicator: Check a five-item exit ticket after reteaching; target at least 4 correct answers.
            5. Parent/guardian note: Please ask ${row.firstName} to explain one lesson idea at home and praise effort before correcting answers.
        """.trimIndent()
    }

    private fun Throwable.geminiFailureDetail(): String {
        val message = message?.takeIf { it.isNotBlank() } ?: this::class.simpleName.orEmpty()
        return message
    }

    private class GeminiRequestException(message: String) : Exception(message)

    private companion object {
        const val GEMINI_MODEL = "gemini-2.5-flash"
        val CONTENT_STYLE_RULES = """
            Style rules:
            - Be concise but complete enough for the selected topic.
            - Write for 10-year-old learners.
            - Use simple words and short sentences.
            - Prefer concrete examples over abstract explanation.
            - Use short bullets or short paragraphs.
            - Avoid filler, but do not make the answer tiny.
        """.trimIndent()
    }
}
