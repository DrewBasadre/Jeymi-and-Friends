package com.pangarap.learninghub.data.repository

import com.pangarap.learninghub.data.local.LearningHubDatabase
import com.pangarap.learninghub.data.local.ModuleEntity
import com.pangarap.learninghub.domain.SubjectType
import kotlinx.coroutines.flow.Flow
import java.util.UUID

class ModuleRepository(private val db: LearningHubDatabase) {
    fun modulesForGrade(gradeLevel: Int): Flow<List<ModuleEntity>> = db.moduleDao().modulesForGrade(gradeLevel)

    fun observeModule(moduleId: String): Flow<ModuleEntity?> = db.moduleDao().observeModule(moduleId)

    suspend fun addTextMaterialForStudent(studentId: String, sourceName: String, rawText: String): ModuleEntity {
        val student = db.studentDao().getStudent(studentId)
        val title = extractLessonTitle(rawText)
            ?: titleFromFileName(sourceName)
            ?: "Added Material"
        val module = ModuleEntity(
            id = "added_${UUID.randomUUID()}",
            title = title.take(80),
            subject = SubjectType.ADDED_MATERIALS.name,
            gradeLevel = student?.gradeLevel ?: 5,
            quarter = 0,
            competencyCode = title.take(80),
            content = rawText.trim(),
            isTeacherCreated = true
        )
        db.moduleDao().insert(module)
        return module
    }

    private fun extractLessonTitle(rawText: String): String? {
        return rawText.lineSequence()
            .map { it.trim() }
            .firstNotNullOfOrNull { line ->
                val match = Regex("^(Lesson Title|Title):\\s*(.+)$", RegexOption.IGNORE_CASE).find(line)
                match?.groupValues?.getOrNull(2)?.trim()?.takeIf { it.isNotBlank() }
            }
    }

    private fun titleFromFileName(sourceName: String): String? {
        val fileName = sourceName
            .substringAfterLast('/')
        return fileName
            .substringBeforeLast('.', fileName)
            .replace(Regex("[_-]+"), " ")
            .trim()
            .takeIf { it.isNotBlank() }
    }
}
