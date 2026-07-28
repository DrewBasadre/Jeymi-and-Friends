package com.pangarap.learninghub.curriculum

/*
 * Integration Notes
 * -----------------
 * Prompt templates are isolated here so LessonPlanService and future UI layers
 * can reuse a single source of truth. Placeholders are populated by
 * LessonPromptTemplates.lessonSystemInstruction before the Gemini request.
 *
 * Placeholder contract:
 * - {grade_level}: user-selected grade level
 * - {subject}: user-selected subject
 * - {duration_minutes}: requested lesson duration
 * - {curriculum_context}: retrieved source chunks with inline metadata
 * - {lesson_request}: teacher lesson request
 */
object LessonPromptTemplates {
    const val LESSON_SYSTEM_INSTRUCTION_TEMPLATE: String = """
You are an expert instructional designer. Your task is to generate a structured lesson plan.
STRICT OPERATING CONSTRAINTS:

You MUST ground every objective, activity, and assessment in the provided CURRICULUM CONTEXT below.
You MUST NOT introduce learning objectives, standards, or competencies that are not present in the CURRICULUM CONTEXT.
If the lesson request cannot be fully addressed by the CURRICULUM CONTEXT, you MUST explicitly state which aspects are unsupported and limit your output to what is grounded.
Cite the specific curriculum standard or competency code for each learning objective using the notation [SRC: {source_reference}].

CURRICULUM CONTEXT (Source of Truth):
{curriculum_context}
LESSON PARAMETERS:

Subject: {subject}
Grade Level: {grade_level}
Lesson Request: {lesson_request}
Duration: {duration_minutes} minutes

OUTPUT FORMAT (respond in valid JSON only, no markdown):
json{
  "lesson_title": "string",
  "grade_level": "string",
  "subject": "string",
  "duration_minutes": integer,
  "learning_objectives": [
    { "objective": "string", "curriculum_reference": "string" }
  ],
  "lesson_outline": [
    { "phase": "string", "duration_minutes": integer, "activity": "string", "materials": ["string"] }
  ],
  "assessment_strategy": "string",
  "differentiation_notes": "string",
  "curriculum_citations": ["string"],
  "quiz_unlocked": false
}
"""

    fun lessonSystemInstruction(
        gradeLevel: String,
        subject: String,
        durationMinutes: Int,
        curriculumContext: String,
        lessonRequest: String
    ): String =
        LESSON_SYSTEM_INSTRUCTION_TEMPLATE
            .replace("{grade_level}", gradeLevel)
            .replace("{subject}", subject)
            .replace("{duration_minutes}", durationMinutes.toString())
            .replace("{curriculum_context}", curriculumContext)
            .replace("{lesson_request}", lessonRequest)

    fun lessonUserPrompt(
        lessonRequest: String,
        gradeLevel: String,
        subject: String,
        durationMinutes: Int
    ): String =
        """
        Generate one valid JSON lesson plan for this request using only the curriculum context in the system instruction.

        Lesson request: $lessonRequest
        Subject: $subject
        Grade level: $gradeLevel
        Duration: $durationMinutes minutes
        """.trimIndent()
}
