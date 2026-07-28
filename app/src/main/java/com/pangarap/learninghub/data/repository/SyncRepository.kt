package com.pangarap.learninghub.data.repository

import com.pangarap.learninghub.data.local.LearningHubDatabase
import com.pangarap.learninghub.data.local.ModuleEntity
import com.pangarap.learninghub.data.local.ProgressEntity
import com.pangarap.learninghub.data.local.QuizAttemptEntity
import com.pangarap.learninghub.data.local.QuizQuestionEntity
import com.pangarap.learninghub.data.local.StudentEntity
import com.pangarap.learninghub.domain.GurobotInput
import com.pangarap.learninghub.domain.LearningCalculations
import com.pangarap.learninghub.domain.MasteryLevel
import com.pangarap.learninghub.domain.ProgressStatus
import com.pangarap.learninghub.domain.QuestionType
import com.pangarap.learninghub.sync.ProgressExport
import com.pangarap.learninghub.sync.QuizAttemptExport
import com.pangarap.learninghub.sync.QuizResultQr
import com.pangarap.learninghub.sync.StudentProfileQr
import com.pangarap.learninghub.sync.TeacherModuleQr
import com.pangarap.learninghub.sync.TeacherModuleQuestionQr
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

class SyncRepository(private val db: LearningHubDatabase) {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val displayJson = Json { prettyPrint = true; ignoreUnknownKeys = true; isLenient = true }

    suspend fun exportStudentProgress(studentId: String): String {
        val student = db.studentDao().getStudent(studentId) ?: error("Student not found")
        val attempts = db.quizAttemptDao().getAttemptsForStudent(studentId)
        val progress = db.progressDao().getProgressForStudent(studentId)
        val totalModules = db.moduleDao().countForGrade(student.gradeLevel)
        val completedModules = progress.filter { it.status == ProgressStatus.COMPLETED.name }.map { it.moduleId }
        val export = ProgressExport(
            studentId = student.id,
            displayName = student.name,
            gradeLevel = student.gradeLevel,
            section = student.section,
            schoolYear = "2026-2027",
            quizAttempts = attempts.map {
                QuizAttemptExport(
                    attemptId = it.id,
                    moduleId = it.moduleId,
                    score = it.score,
                    totalItems = it.totalItems,
                    weakTopic = it.weakTopic,
                    strongTopic = it.strongTopic,
                    masteryLevel = it.masteryLevel,
                    durationSeconds = it.durationSeconds,
                    attemptNumber = it.attemptNumber,
                    submittedAt = it.submittedAt
                )
            },
            completedModules = completedModules,
            weakTopics = attempts.map { it.weakTopic }.filter { it != "Ready for next challenge" }.distinct(),
            gradeCompletionPercent = LearningCalculations.completionPercent(completedModules.size, totalModules)
        )
        return json.encodeToString(export)
    }

    fun studentProfileJson(
        studentId: String,
        studentNumber: String,
        firstName: String,
        lastName: String,
        middleInitial: String,
        gradeLevel: Int,
        section: String,
        birthday: String
    ): String {
        return json.encodeToString(
            StudentProfileQr(
                studentId = studentId,
                studentNumber = studentNumber.trim(),
                firstName = firstName.trim(),
                lastName = lastName.trim(),
                middleInitial = middleInitial.trim().take(1),
                gradeLevel = gradeLevel,
                section = section.trim(),
                birthday = birthday.trim()
            )
        )
    }

    suspend fun exportBestQuizResult(studentId: String, moduleId: String): String {
        val student = db.studentDao().getStudent(studentId) ?: error("Student not found")
        val module = db.moduleDao().getModule(moduleId) ?: error("Module not found")
        val attempts = db.quizAttemptDao().getAttemptsForModule(studentId, moduleId)
        val best = attempts.maxWithOrNull(
            compareBy<QuizAttemptEntity> { it.score.toDouble() / it.totalItems.coerceAtLeast(1) }
                .thenBy { it.submittedAt }
        ) ?: error("No quiz attempts found")
        return json.encodeToString(
            QuizResultQr(
                attemptId = best.id,
                studentId = student.id,
                studentNumber = student.studentNumber,
                firstName = student.firstName,
                lastName = student.lastName,
                middleInitial = student.middleInitial,
                displayName = student.name,
                gradeLevel = student.gradeLevel,
                section = student.section,
                moduleId = module.id,
                moduleTitle = module.title,
                subject = module.subject,
                competencyCode = module.competencyCode,
                score = best.score,
                totalItems = best.totalItems,
                weakTopic = best.weakTopic,
                strongTopic = best.strongTopic,
                masteryLevel = best.masteryLevel,
                durationSeconds = best.durationSeconds,
                attemptNumber = best.attemptNumber,
                submittedAt = best.submittedAt
            )
        )
    }

    fun teacherModuleJson(input: GurobotInput, content: String): String {
        val subject = input.subject.uppercase()
        val moduleId = "teacher_${subject.lowercase()}_g${input.gradeLevel}_q${input.quarter}_m${input.moduleNumber}_${input.topic.slug()}"
        val questions = generatedQuestions(moduleId, input.topic)
        return json.encodeToString(
            TeacherModuleQr(
                moduleId = moduleId,
                title = input.topic,
                subject = subject,
                gradeLevel = input.gradeLevel,
                quarter = input.quarter,
                moduleNumber = input.moduleNumber,
                competencyCode = input.competencyCode,
                content = content,
                questions = questions
            )
        )
    }

    suspend fun saveTeacherModule(input: GurobotInput, content: String): String {
        return importTeacherModule(teacherModuleJson(input, content))
    }

    fun formatQrPayload(rawJson: String): String {
        val payload = normalizeQrPayload(rawJson)
            ?: return "This QR code does not contain a valid PAVO QR payload."
        return try {
            when (payloadType(payload)) {
                "student_profile" -> json.decodeFromString<StudentProfileQr>(payload).let {
                    """
                    Student Information
                    Student No.: ${it.studentNumber}
                    Name: ${formattedName(it.lastName, it.firstName, it.middleInitial)}
                    Grade & Section: Grade ${it.gradeLevel} - ${it.section}
                    Birthday: ${it.birthday.ifBlank { "Not set" }}
                    """.trimIndent()
                }
                "quiz_result" -> json.decodeFromString<QuizResultQr>(payload).let {
                    """
                    Quiz Result
                    Student: ${formattedName(it.lastName, it.firstName, it.middleInitial)}
                    Student No.: ${it.studentNumber}
                    Module: ${it.moduleTitle}
                    Subject: ${it.subject}
                    Lesson Name: ${it.competencyCode.ifBlank { it.moduleTitle }}
                    Score: ${it.score}/${it.totalItems}
                    Best Attempt: ${it.attemptNumber}
                    Time: ${formatDuration(it.durationSeconds)}
                    Weak Topic: ${it.weakTopic}
                    Strong Topic: ${it.strongTopic}
                    """.trimIndent()
                }
                "teacher_module" -> decodeTeacherModule(payload).let {
                    """
                    Teacher Module
                    ${if (it.moduleNumber > 0) "Additional Module ${it.moduleNumber}" else "Additional Module"}: ${it.title}
                    Subject: ${it.subject}
                    Grade ${it.gradeLevel}, Quarter ${it.quarter}
                    Lesson Name: ${it.competencyCode.ifBlank { it.title }}
                    Quiz Items: ${it.questions.size}

                    ${it.content}
                    """.trimIndent()
                }
                "progress_export", "" -> json.decodeFromString<ProgressExport>(payload).let {
                    """
                    Progress Export
                    Student: ${it.displayName}
                    Grade & Section: Grade ${it.gradeLevel} - ${it.section}
                    Completion: ${it.gradeCompletionPercent}%
                    Quiz Attempts: ${it.quizAttempts.size}
                    Weak Topics: ${it.weakTopics.ifEmpty { listOf("None yet") }.joinToString()}
                    """.trimIndent()
                }
                else -> "Unsupported PAVO QR payload."
            }
        } catch (error: Exception) {
            "This QR code does not contain a valid PAVO QR payload."
        }
    }

    suspend fun importStudentProgress(rawJson: String): String {
        return importTeacherScan(rawJson)
    }

    suspend fun importTeacherScan(rawJson: String): String {
        val payload = normalizeQrPayload(rawJson)
            ?: return "Import failed: paste, scan, or upload a valid PAVO QR JSON."
        return try {
            when (payloadType(payload)) {
                "student_profile" -> importStudentProfile(payload)
                "quiz_result" -> importQuizResult(payload)
                "progress_export", "" -> importProgressExport(payload)
                else -> "Import failed: QR JSON is not a supported teacher scan payload."
            }
        } catch (error: Exception) {
            "Import failed: paste or scan a valid PAVO QR JSON."
        }
    }

    suspend fun importStudentScan(rawJson: String): String {
        val payload = normalizeQrPayload(rawJson)
            ?: return "Import failed: paste, scan, or upload a valid teacher module QR JSON."
        return try {
            when (payloadType(payload)) {
                "teacher_module" -> importTeacherModule(payload)
                else -> "Import failed: QR JSON is not a teacher module payload."
            }
        } catch (error: Exception) {
            "Import failed: paste or scan a valid teacher module QR JSON."
        }
    }

    private suspend fun importStudentProfile(rawJson: String): String {
        val profile = json.decodeFromString<StudentProfileQr>(rawJson)
        val studentNumber = profile.studentNumber.ifBlank { "student-${System.currentTimeMillis()}" }
        val id = profile.studentId.ifBlank { studentNumber.studentId() }
        val displayName = listOf(profile.firstName, profile.lastName)
            .filter { it.isNotBlank() }
            .joinToString(" ")
            .ifBlank { studentNumber }
        db.studentDao().insert(
            StudentEntity(
                id = id,
                studentNumber = studentNumber,
                firstName = profile.firstName,
                lastName = profile.lastName,
                middleInitial = profile.middleInitial,
                name = displayName,
                gradeLevel = profile.gradeLevel,
                section = profile.section,
                birthday = profile.birthday,
                profileImageUri = "",
                pin = "1234",
                avatarColor = avatarColor(studentNumber)
            )
        )
        return "Added $displayName to the class. Default PIN: 1234."
    }

    private suspend fun importQuizResult(rawJson: String): String {
        val result = json.decodeFromString<QuizResultQr>(rawJson)
        val student = resolveStudentForQuizResult(result)
        db.quizAttemptDao().insert(
            QuizAttemptEntity(
                id = result.attemptId,
                studentId = student.id,
                moduleId = result.moduleId,
                score = result.score,
                totalItems = result.totalItems,
                weakTopic = result.weakTopic,
                strongTopic = result.strongTopic,
                masteryLevel = result.masteryLevel,
                durationSeconds = result.durationSeconds,
                attemptNumber = result.attemptNumber,
                submittedAt = result.submittedAt
            )
        )
        db.progressDao().upsert(
            ProgressEntity(
                id = "${student.id}-${result.moduleId}",
                studentId = student.id,
                moduleId = result.moduleId,
                status = ProgressStatus.COMPLETED.name,
                masteryLevel = result.masteryLevel,
                updatedAt = result.submittedAt
            )
        )
        return "Stored ${student.name.ifBlank { result.displayName }}'s ${result.moduleTitle} result in the record book."
    }

    private suspend fun importProgressExport(rawJson: String): String {
        val export = json.decodeFromString<ProgressExport>(rawJson)
        val student = resolveStudentForProgressExport(export)
        val attempts = export.quizAttempts.map {
            QuizAttemptEntity(
                id = it.attemptId,
                studentId = student.id,
                moduleId = it.moduleId,
                score = it.score,
                totalItems = it.totalItems,
                weakTopic = it.weakTopic,
                strongTopic = it.strongTopic,
                masteryLevel = it.masteryLevel,
                durationSeconds = it.durationSeconds,
                attemptNumber = it.attemptNumber,
                submittedAt = it.submittedAt
            )
        }
        db.quizAttemptDao().insertAll(attempts)
        db.progressDao().upsertAll(
            export.completedModules.map { moduleId ->
                ProgressEntity(
                    id = "${student.id}-$moduleId",
                    studentId = student.id,
                    moduleId = moduleId,
                    status = ProgressStatus.COMPLETED.name,
                    masteryLevel = MasteryLevel.PROFICIENT.name,
                    updatedAt = System.currentTimeMillis()
                )
            }
        )
        return "Imported ${attempts.size} attempt(s) for ${student.name.ifBlank { export.displayName }}."
    }

    private suspend fun importTeacherModule(rawJson: String): String {
        val module = decodeTeacherModule(rawJson)
        db.moduleDao().insert(
            ModuleEntity(
                id = module.moduleId,
                title = module.title,
                subject = module.subject.uppercase(),
                gradeLevel = module.gradeLevel,
                quarter = module.quarter,
                competencyCode = module.competencyCode,
                content = module.content,
                isTeacherCreated = true
            )
        )
        val questions = if (module.questions.isEmpty()) {
            generatedQuestions(module.moduleId, module.title)
        } else {
            module.questions
        }
        db.quizQuestionDao().insertAll(
            questions.mapIndexed { index, question ->
                QuizQuestionEntity(
                    id = question.id.ifBlank { "${module.moduleId}_q${index + 1}" },
                    moduleId = module.moduleId,
                    type = question.type,
                    questionText = question.questionText,
                    choicesJson = json.encodeToString(question.choices),
                    correctAnswer = question.correctAnswer,
                    topicTag = question.topicTag
                )
            }
        )
        return "Added Additional Module ${module.moduleNumber}: ${module.title}."
    }

    private fun normalizeQrPayload(rawText: String): String? {
        val cleaned = cleanQrText(rawText)
        val direct = parseLearningHubPayload(cleaned)
        if (direct != null) return direct
        val extracted = extractJsonObject(cleaned) ?: return null
        return parseLearningHubPayload(extracted)
    }

    private fun parseLearningHubPayload(text: String): String? {
        var candidate = text.trim()
        repeat(3) {
            val element = runCatching { json.parseToJsonElement(candidate) }.getOrNull() ?: return@repeat
            when (element) {
                is JsonObject -> {
                    findLearningHubObject(element)?.let { return canonicalPayloadJson(it) }
                }
                is JsonPrimitive -> {
                    val nested = element.contentOrNull?.trim().orEmpty()
                    if (nested.isNotBlank() && nested != candidate) {
                        candidate = nested
                    }
                }
                else -> return@repeat
            }
        }
        return null
    }

    private fun cleanQrText(rawText: String): String {
        var text = rawText.trim().trim('\uFEFF')
        if (text.startsWith("```")) {
            text = text
                .lineSequence()
                .filterNot { it.trim().startsWith("```") }
                .joinToString("\n")
                .trim()
        }
        return text
    }

    private fun extractJsonObject(text: String): String? {
        val start = text.indexOf('{')
        if (start < 0) return null
        var depth = 0
        var inString = false
        var escaped = false
        for (index in start until text.length) {
            val char = text[index]
            if (escaped) {
                escaped = false
                continue
            }
            if (char == '\\' && inString) {
                escaped = true
                continue
            }
            if (char == '"') {
                inString = !inString
                continue
            }
            if (inString) continue
            when (char) {
                '{' -> depth++
                '}' -> {
                    depth--
                    if (depth == 0) return text.substring(start, index + 1)
                }
            }
        }
        return null
    }

    private fun findLearningHubObject(element: JsonObject): JsonObject? {
        if (inferPayloadType(element).isNotBlank()) return element
        listOf("payload", "data", "json", "module", "lesson", "qr").forEach { key ->
            val child = element[key]
            if (child is JsonObject) {
                findLearningHubObject(child)?.let { return it }
            }
            if (child is JsonPrimitive) {
                parseLearningHubPayload(child.contentOrNull.orEmpty())?.let {
                    return json.parseToJsonElement(it).jsonObject
                }
            }
        }
        return null
    }

    private fun canonicalPayloadJson(payload: JsonObject): String {
        val type = inferPayloadType(payload)
        if (type != "teacher_module") {
            return if (payload["payloadType"] == null) {
                displayJson.encodeToString(
                    buildJsonObject {
                        put("payloadType", type)
                        payload.forEach { (key, value) -> put(key, value) }
                    }
                )
            } else {
                displayJson.encodeToString(payload)
            }
        }
        return canonicalTeacherModuleJson(payload)
    }

    private fun canonicalTeacherModuleJson(payload: JsonObject): String {
        val title = payload.stringValue("title")
            .ifBlank { payload.stringValue("lessonName") }
            .ifBlank { payload.stringValue("lesson_name") }
            .ifBlank { payload.stringValue("name") }
            .ifBlank { "Imported Lesson" }
        val subject = payload.stringValue("subject").ifBlank { "GENERAL" }.uppercase()
        val gradeLevel = payload.intValue("gradeLevel")
            ?: payload.intValue("grade")
            ?: 5
        val quarter = payload.intValue("quarter") ?: 1
        val moduleNumber = payload.intValue("moduleNumber")
            ?: payload.intValue("module")
            ?: 0
        val moduleId = payload.stringValue("moduleId")
            .ifBlank { payload.stringValue("id") }
            .ifBlank { "teacher_${subject.lowercase()}_g${gradeLevel}_q${quarter}_${title.slug()}" }
        val content = payload.stringValue("content")
            .ifBlank { payload.stringValue("text") }
            .ifBlank { payload.stringValue("body") }
            .ifBlank { payload.stringValue("lessonText") }
            .ifBlank { lessonContentFromPayload(payload) }
        val lessonName = payload.stringValue("lessonName")
            .ifBlank { payload.stringValue("lesson_name") }
            .ifBlank { payload.stringValue("competencyCode") }
            .ifBlank { title }
        return displayJson.encodeToString(
            buildJsonObject {
                put("payloadType", "teacher_module")
                put("moduleId", moduleId)
                put("title", title)
                put("subject", subject)
                put("gradeLevel", gradeLevel)
                put("quarter", quarter)
                put("moduleNumber", moduleNumber)
                put("competencyCode", lessonName)
                put("content", content)
                payload["questions"]?.takeUnless { it.toString() == "null" }?.let { put("questions", it) }
            }
        )
    }

    private fun decodeTeacherModule(rawJson: String): TeacherModuleQr =
        json.decodeFromString(canonicalPayloadJson(json.parseToJsonElement(rawJson).jsonObject))

    private fun inferPayloadType(payload: JsonObject): String {
        payload["payloadType"]?.jsonPrimitive?.contentOrNull?.let { return it }
        payload["type"]?.jsonPrimitive?.contentOrNull?.let { type ->
            when (type.lowercase()) {
                "student_profile", "student-profile", "student" -> return "student_profile"
                "quiz_result", "quiz-result", "result" -> return "quiz_result"
                "progress_export", "progress-export", "progress" -> return "progress_export"
                "teacher_module", "teacher-module", "module", "lesson" -> return "teacher_module"
            }
        }
        return when {
            payload["quizAttempts"] != null && payload["studentId"] != null -> "progress_export"
            payload["attemptId"] != null && payload["score"] != null && payload["totalItems"] != null -> "quiz_result"
            payload["studentNumber"] != null && payload["firstName"] != null && payload["lastName"] != null -> "student_profile"
            payload["content"] != null && (payload["title"] != null || payload["lessonName"] != null || payload["lesson_name"] != null) -> "teacher_module"
            (payload["title"] != null || payload["lessonName"] != null || payload["lesson_name"] != null) &&
                (payload["subject"] != null || payload["gradeLevel"] != null || payload["objectives"] != null || payload["assessment"] != null) -> "teacher_module"
            payload["questions"] != null && payload["subject"] != null -> "teacher_module"
            else -> ""
        }
    }

    private fun lessonContentFromPayload(payload: JsonObject): String {
        val ignoredKeys = setOf(
            "payloadType",
            "type",
            "kind",
            "moduleId",
            "id",
            "title",
            "name",
            "lessonName",
            "lesson_name",
            "subject",
            "gradeLevel",
            "grade",
            "quarter",
            "moduleNumber",
            "module",
            "competencyCode",
            "questions"
        )
        return payload.entries
            .filterNot { (key, value) -> key in ignoredKeys || value.toString() == "null" }
            .joinToString("\n\n") { (key, value) ->
                "${key.humanizeKey()}\n${value.readableJsonValue()}"
            }
            .ifBlank { displayJson.encodeToString(payload) }
    }

    private suspend fun resolveStudentForQuizResult(result: QuizResultQr): StudentEntity {
        db.studentDao().findByQrIdentity(
            studentId = result.studentId,
            studentNumber = result.studentNumber,
            firstName = result.firstName,
            lastName = result.lastName,
            displayName = result.displayName
        )?.let { return it }

        val idSeed = result.studentId
            .ifBlank { result.studentNumber }
            .ifBlank { result.displayName }
            .ifBlank { "${result.firstName} ${result.lastName}" }
            .ifBlank { "student-${System.currentTimeMillis()}" }
        val displayName = result.displayName.ifBlank {
            listOf(result.firstName, result.lastName)
                .filter { it.isNotBlank() }
                .joinToString(" ")
        }.ifBlank { result.studentNumber.ifBlank { idSeed } }
        val student = StudentEntity(
            id = result.studentId.ifBlank { idSeed.studentId() },
            studentNumber = result.studentNumber.ifBlank { idSeed },
            firstName = result.firstName.ifBlank { displayName.firstNamePart() },
            lastName = result.lastName.ifBlank { displayName.lastNamePart() },
            middleInitial = result.middleInitial,
            name = displayName,
            gradeLevel = result.gradeLevel,
            section = result.section,
            birthday = "",
            profileImageUri = "",
            pin = "1234",
            avatarColor = avatarColor(result.studentNumber.ifBlank { idSeed })
        )
        db.studentDao().insert(student)
        return student
    }

    private suspend fun resolveStudentForProgressExport(export: ProgressExport): StudentEntity {
        val firstName = export.displayName.firstNamePart()
        val lastName = export.displayName.lastNamePart()
        db.studentDao().findByQrIdentity(
            studentId = export.studentId,
            studentNumber = "",
            firstName = firstName,
            lastName = lastName,
            displayName = export.displayName
        )?.let { return it }

        val idSeed = export.studentId.ifBlank { export.displayName }.ifBlank { "student-${System.currentTimeMillis()}" }
        val displayName = export.displayName.ifBlank { idSeed }
        val student = StudentEntity(
            id = export.studentId.ifBlank { idSeed.studentId() },
            studentNumber = export.studentId.ifBlank { idSeed },
            firstName = firstName.ifBlank { displayName },
            lastName = lastName,
            middleInitial = "",
            name = displayName,
            gradeLevel = export.gradeLevel,
            section = export.section,
            birthday = "",
            profileImageUri = "",
            pin = "1234",
            avatarColor = avatarColor(idSeed)
        )
        db.studentDao().insert(student)
        return student
    }

    private fun payloadType(rawJson: String): String {
        val element = json.parseToJsonElement(rawJson)
        return inferPayloadType(element.jsonObject)
    }

    private fun JsonObject.stringValue(key: String): String =
        this[key]?.jsonPrimitive?.contentOrNull.orEmpty()

    private fun JsonObject.intValue(key: String): Int? =
        this[key]?.jsonPrimitive?.intOrNull

    private fun JsonElement.readableJsonValue(): String =
        when (this) {
            is JsonPrimitive -> contentOrNull.orEmpty().ifBlank { toString() }
            else -> displayJson.encodeToString(this)
        }

    private fun String.humanizeKey(): String =
        replace(Regex("([a-z])([A-Z])"), "$1 $2")
            .replace('_', ' ')
            .replace('-', ' ')
            .split(Regex("\\s+"))
            .filter { it.isNotBlank() }
            .joinToString(" ") { word -> word.replaceFirstChar { it.uppercase() } }

    private fun generatedQuestions(moduleId: String, topic: String): List<TeacherModuleQuestionQr> =
        listOf(
            TeacherModuleQuestionQr(
                id = "${moduleId}_q1",
                type = QuestionType.TRUE_FALSE.name,
                questionText = "$topic can be explained using examples from the lesson.",
                choices = listOf("True", "False"),
                correctAnswer = "True",
                topicTag = topic
            ),
            TeacherModuleQuestionQr(
                id = "${moduleId}_q2",
                type = QuestionType.IDENTIFICATION.name,
                questionText = "Write one key idea from the lesson about $topic.",
                correctAnswer = topic,
                topicTag = topic
            ),
            TeacherModuleQuestionQr(
                id = "${moduleId}_q3",
                type = QuestionType.MULTIPLE_CHOICE.name,
                questionText = "What should a learner do after studying $topic?",
                choices = listOf("Guess silently", "Explain the idea", "Skip the activity", "Erase notes"),
                correctAnswer = "Explain the idea",
                topicTag = topic
            )
        )

    private fun String.slug(): String =
        lowercase()
            .replace(Regex("[^a-z0-9]+"), "_")
            .trim('_')
            .ifBlank { "lesson" }

    private fun String.studentId(): String = "student_${slug()}"

    private fun String.firstNamePart(): String {
        val cleaned = trim()
        if (cleaned.isBlank()) return ""
        if (cleaned.contains(",")) {
            return cleaned.substringAfter(",").trim().substringBefore(" ").trim(',', ' ')
        }
        return cleaned.substringBefore(" ").trim()
    }

    private fun String.lastNamePart(): String {
        val cleaned = trim()
        if (cleaned.isBlank()) return ""
        if (cleaned.contains(",")) {
            return cleaned.substringBefore(",").trim()
        }
        return cleaned.substringAfter(" ", "").trim()
    }

    private fun avatarColor(seed: String): Long {
        val palette = listOf(0xFF0F766EL, 0xFF2563EBL, 0xFF9333EAL, 0xFFCA8A04L, 0xFF16A34AL, 0xFFEA580CL)
        return palette[(seed.hashCode() and Int.MAX_VALUE) % palette.size]
    }

    private fun formattedName(lastName: String, firstName: String, middleInitial: String): String {
        val middle = middleInitial.trim().take(1).let { if (it.isBlank()) "" else ", $it." }
        return "${lastName.trim()}, ${firstName.trim()}$middle".trim(',', ' ')
    }

    private fun formatDuration(seconds: Long): String {
        if (seconds <= 0) return "0s"
        val minutes = seconds / 60
        val secs = seconds % 60
        return if (minutes > 0) "${minutes}m ${secs}s" else "${secs}s"
    }
}
