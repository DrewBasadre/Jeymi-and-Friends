package com.pangarap.learninghub.curriculum

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

/*
 * Integration Notes
 * -----------------
 * LessonPlanService orchestrates retrieval from CurriculumStore and generation
 * through Gemini. It never reads curriculum files directly and never generates
 * content without retrieved curriculum chunks above the configured threshold.
 *
 * Required configuration:
 * - GEMINI_API_KEY through BuildConfig, populated from Gradle/environment.
 * - A preconfigured CurriculumStore for the target curriculum source.
 */
class LessonPlanService(
    private val geminiClient: GeminiRestClient = GeminiRestClient(),
    private val changelogManager: ChangelogManager = ChangelogManager(),
    private val config: LessonPlanServiceConfig = LessonPlanServiceConfig(),
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    suspend fun generateLessonPlan(
        lessonRequest: String,
        gradeLevel: String,
        subject: String,
        durationMinutes: Int,
        curriculumStore: CurriculumStore
    ): LessonPlanGenerationResult {
        if (lessonRequest.isBlank() || gradeLevel.isBlank() || subject.isBlank() || durationMinutes <= 0) {
            return serviceError("VALIDATION_ERROR", "Lesson request, grade level, subject, and duration must be valid.")
        }

        return runCatching {
            val retrieved = curriculumStore.retrieve(query = lessonRequest, topK = 5)
                .filter { (it.similarityScore ?: 0.0) >= config.similarityThreshold }
            if (retrieved.isEmpty()) {
                serviceError(
                    error = "NO_CURRICULUM_MATCH",
                    message = "The requested topic could not be mapped to the indexed curriculum."
                )
            } else {
                val curriculumContext = CurriculumContextFormatter.format(
                    chunks = retrieved,
                    maxApproxTokens = config.contextTokenLimit
                )
                val systemInstruction = LessonPromptTemplates.lessonSystemInstruction(
                    gradeLevel = gradeLevel,
                    subject = subject,
                    durationMinutes = durationMinutes,
                    curriculumContext = curriculumContext,
                    lessonRequest = lessonRequest
                )
                val userPrompt = LessonPromptTemplates.lessonUserPrompt(
                    lessonRequest = lessonRequest,
                    gradeLevel = gradeLevel,
                    subject = subject,
                    durationMinutes = durationMinutes
                )
                val generatedText = geminiClient.generateContent(
                    model = config.model,
                    userPrompt = userPrompt,
                    systemInstruction = systemInstruction,
                    generationConfig = GeminiGenerationConfig(
                        temperature = config.temperature,
                        topP = config.topP,
                        maxOutputTokens = config.maxOutputTokens,
                        responseMimeType = "application/json",
                        maxRetries = config.maxRetries
                    )
                )
                parseAndValidateWithCorrection(
                    generatedText = generatedText,
                    correctionPrompt = userPrompt,
                    systemInstruction = systemInstruction,
                    citations = retrieved.map { it.sourceReference() }.distinct()
                ).also { result ->
                    if (result is LessonPlanResponse) {
                        changelogManager.logLessonGenerated(
                            lessonTitle = result.lessonTitle,
                            subject = result.subject,
                            gradeLevel = result.gradeLevel,
                            retrievedChunkCount = retrieved.size
                        )
                    }
                }
            }
        }.getOrElse { failure ->
            changelogManager.logError(
                componentName = "LessonPlanService",
                errorCodeOrType = failure::class.simpleName.orEmpty(),
                description = failure.message.orEmpty().ifBlank { "Lesson plan generation failed" }
            )
            ServiceError("GENERATION_ERROR", "Lesson plan generation failed: ${failure.safeMessage()}")
        }
    }

    suspend fun generate_lesson_plan(
        lesson_request: String,
        grade_level: String,
        subject: String,
        duration_minutes: Int,
        curriculum_store: CurriculumStore
    ): LessonPlanGenerationResult =
        generateLessonPlan(
            lessonRequest = lesson_request,
            gradeLevel = grade_level,
            subject = subject,
            durationMinutes = duration_minutes,
            curriculumStore = curriculum_store
        )

    private suspend fun parseAndValidateWithCorrection(
        generatedText: String,
        correctionPrompt: String,
        systemInstruction: String,
        citations: List<String>
    ): LessonPlanGenerationResult {
        val firstAttempt = parseLessonPlan(generatedText, citations)
        if (firstAttempt is LessonPlanResponse) return firstAttempt
        val invalidReason = (firstAttempt as? ServiceError)?.message ?: "Response did not match LessonPlanResponse."
        val correction = """
            $correctionPrompt

            The previous response was invalid: $invalidReason
            Return corrected valid JSON only. Include every required field and set "quiz_unlocked" to false.
        """.trimIndent()
        val correctedText = geminiClient.generateContent(
            model = config.model,
            userPrompt = correction,
            systemInstruction = systemInstruction,
            generationConfig = GeminiGenerationConfig(
                temperature = config.temperature,
                topP = config.topP,
                maxOutputTokens = config.maxOutputTokens,
                responseMimeType = "application/json",
                maxRetries = config.maxRetries
            )
        )
        return parseLessonPlan(correctedText, citations).let { corrected ->
            if (corrected is LessonPlanResponse) corrected else serviceError(
                error = "INVALID_GEMINI_RESPONSE",
                message = "Gemini did not return a valid LessonPlanResponse after one correction attempt."
            )
        }
    }

    private fun parseLessonPlan(raw: String, citations: List<String>): LessonPlanGenerationResult {
        return try {
            val parsed = json.decodeFromString<LessonPlanResponse>(raw.extractJsonObject())
            val normalized = parsed.copy(
                curriculumCitations = citations,
                quizUnlocked = false
            )
            val validationError = normalized.validationError()
            if (validationError == null) normalized else serviceError("INVALID_GEMINI_RESPONSE", validationError)
        } catch (failure: SerializationException) {
            serviceError("INVALID_GEMINI_RESPONSE", failure.message.orEmpty().ifBlank { "Response was not valid JSON" })
        } catch (failure: IllegalArgumentException) {
            serviceError("INVALID_GEMINI_RESPONSE", failure.message.orEmpty().ifBlank { "Response was not a JSON object" })
        }
    }

    private fun serviceError(error: String, message: String): ServiceError {
        changelogManager.logError(
            componentName = "LessonPlanService",
            errorCodeOrType = error,
            description = message
        )
        return ServiceError(error, message)
    }
}

object CurriculumContextFormatter {
    fun format(chunks: List<CurriculumChunk>, maxApproxTokens: Int): String {
        val ordered = chunks.sortedByDescending { it.similarityScore ?: 0.0 }
        val lines = mutableListOf<String>()
        var tokenCount = 0
        ordered.forEachIndexed { index, chunk ->
            val block = """
                [CHUNK ${index + 1}]
                Source: ${chunk.sourceReference()}
                Similarity: ${"%.4f".format(chunk.similarityScore ?: 0.0)}
                Text: ${chunk.text}
            """.trimIndent()
            val blockTokens = block.approxTokenCount()
            if (tokenCount + blockTokens <= maxApproxTokens || lines.isEmpty()) {
                lines.add(block)
                tokenCount += blockTokens
            }
        }
        return lines.joinToString("\n\n")
    }
}

data class LessonPlanServiceConfig(
    val model: String = "gemini-1.5-pro",
    val similarityThreshold: Double = 0.72,
    val contextTokenLimit: Int = 6_000,
    val temperature: Double = 0.3,
    val topP: Double = 0.85,
    val maxOutputTokens: Int = 4_096,
    val maxRetries: Int = 3
)

sealed interface LessonPlanGenerationResult

@Serializable
data class LessonPlanResponse(
    @SerialName("lesson_title") val lessonTitle: String,
    @SerialName("grade_level") val gradeLevel: String,
    val subject: String,
    @SerialName("duration_minutes") val durationMinutes: Int,
    @SerialName("learning_objectives") val learningObjectives: List<LessonLearningObjective>,
    @SerialName("lesson_outline") val lessonOutline: List<LessonOutlineItem>,
    @SerialName("assessment_strategy") val assessmentStrategy: String,
    @SerialName("differentiation_notes") val differentiationNotes: String,
    @SerialName("curriculum_citations") val curriculumCitations: List<String>,
    @SerialName("quiz_unlocked") val quizUnlocked: Boolean = false
) : LessonPlanGenerationResult

@Serializable
data class LessonLearningObjective(
    val objective: String,
    @SerialName("curriculum_reference") val curriculumReference: String
)

@Serializable
data class LessonOutlineItem(
    val phase: String,
    @SerialName("duration_minutes") val durationMinutes: Int,
    val activity: String,
    val materials: List<String>
)

@Serializable
data class ServiceError(
    val error: String,
    val message: String
) : LessonPlanGenerationResult, QuizGenerationResult

private fun LessonPlanResponse.validationError(): String? {
    return when {
        lessonTitle.isBlank() -> "lesson_title is required"
        gradeLevel.isBlank() -> "grade_level is required"
        subject.isBlank() -> "subject is required"
        durationMinutes <= 0 -> "duration_minutes must be positive"
        learningObjectives.isEmpty() -> "learning_objectives must not be empty"
        learningObjectives.any { it.objective.isBlank() || it.curriculumReference.isBlank() } ->
            "each learning objective must include objective and curriculum_reference"
        learningObjectives.any { !it.curriculumReference.contains("[SRC:") } ->
            "each learning objective curriculum_reference must use [SRC: ...] notation"
        lessonOutline.isEmpty() -> "lesson_outline must not be empty"
        lessonOutline.any { it.phase.isBlank() || it.durationMinutes <= 0 || it.activity.isBlank() } ->
            "each lesson outline item must include phase, positive duration_minutes, and activity"
        assessmentStrategy.isBlank() -> "assessment_strategy is required"
        differentiationNotes.isBlank() -> "differentiation_notes is required"
        curriculumCitations.isEmpty() -> "curriculum_citations must not be empty"
        quizUnlocked -> "quiz_unlocked must be false at lesson generation time"
        else -> null
    }
}

fun String.extractJsonObject(): String {
    val trimmed = trim()
        .removePrefix("```json")
        .removePrefix("```")
        .removeSuffix("```")
        .trim()
    val start = trimmed.indexOf('{')
    val end = trimmed.lastIndexOf('}')
    require(start >= 0 && end > start) { "No JSON object found in response" }
    return trimmed.substring(start, end + 1)
}

fun String.approxTokenCount(): Int =
    split(Regex("\\s+")).count { it.isNotBlank() }.coerceAtLeast(length / 4)

private fun Throwable.safeMessage(): String =
    message.orEmpty().ifBlank { this::class.simpleName.orEmpty() }.take(300)
