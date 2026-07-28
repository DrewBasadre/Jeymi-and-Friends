package com.pangarap.learninghub.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.pangarap.learninghub.data.local.LessonPlanEntity
import com.pangarap.learninghub.data.local.StudentEntity
import com.pangarap.learninghub.di.AppContainer
import com.pangarap.learninghub.domain.GurobotInput
import com.pangarap.learninghub.domain.GurobotResponse
import com.pangarap.learninghub.domain.QuizResult
import com.pangarap.learninghub.domain.RecordBookRow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID

class LearningHubViewModel(private val container: AppContainer) : ViewModel() {
    val students = container.studentRepository.activeStudents()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val teacherDashboard = container.teacherRepository.dashboard()
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(5_000),
            com.pangarap.learninghub.domain.TeacherDashboardSummary(0.0, emptyList(), emptyList(), emptyList())
        )

    val recordBook = container.teacherRepository.recordBook()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val lessonPlans = container.teacherRepository.lessonPlans()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _lastQuizResult = MutableStateFlow<QuizResult?>(null)
    val lastQuizResult: StateFlow<QuizResult?> = _lastQuizResult.asStateFlow()

    private val _gurobotResponse = MutableStateFlow<GurobotResponse?>(null)
    val gurobotResponse: StateFlow<GurobotResponse?> = _gurobotResponse.asStateFlow()

    private val _syncMessage = MutableStateFlow("")
    val syncMessage: StateFlow<String> = _syncMessage.asStateFlow()

    private val _studentAssessment = MutableStateFlow("")
    val studentAssessment: StateFlow<String> = _studentAssessment.asStateFlow()

    private val _currentTeacherName = MutableStateFlow("Teacher")
    val currentTeacherName: StateFlow<String> = _currentTeacherName.asStateFlow()

    init {
        viewModelScope.launch {
            container.seeder.seedIfNeeded()
        }
    }

    fun studentDashboard(studentId: String) = container.studentRepository.dashboardSummary(studentId)

    fun observeStudent(studentId: String) = container.studentRepository.observeStudent(studentId)

    fun progressForStudent(studentId: String) = container.studentRepository.progressForStudent(studentId)

    fun attemptsForModule(studentId: String, moduleId: String) =
        container.studentRepository.attemptsForModule(studentId, moduleId)

    suspend fun loginStudent(identifier: String, pin: String): StudentEntity? =
        container.studentRepository.login(identifier, pin)

    fun loginTeacher(teacherNumber: String, password: String, displayName: String = ""): Boolean {
        val number = teacherNumber.trim()
        val secret = password.trim()
        val valid = (number.equals("T-1001", ignoreCase = true) || number.equals("teacher", ignoreCase = true)) &&
            (secret == "teacher123" || secret.equals("password", ignoreCase = true))
        if (valid) {
            _currentTeacherName.value = displayName.trim().ifBlank { "Teacher" }
        }
        return valid
    }

    fun modulesForGrade(gradeLevel: Int) = container.moduleRepository.modulesForGrade(gradeLevel)

    fun observeModule(moduleId: String) = container.moduleRepository.observeModule(moduleId)

    fun questionsForModule(moduleId: String) = container.quizRepository.questionsForModule(moduleId)

    fun hasCompletedAssessment(studentId: String, moduleId: String) =
        container.studentRepository.hasCompletedAssessment(studentId, moduleId)

    fun saveStudentProfile(
        studentId: String?,
        studentNumber: String,
        firstName: String,
        lastName: String,
        middleInitial: String,
        gradeLevel: Int,
        section: String,
        birthday: String,
        pin: String,
        profileImageUri: String = "",
        onSaved: (StudentEntity) -> Unit = {}
    ) {
        viewModelScope.launch {
            val saved = container.studentRepository.saveStudent(
                studentId = studentId,
                studentNumber = studentNumber,
                firstName = firstName,
                lastName = lastName,
                middleInitial = middleInitial,
                gradeLevel = gradeLevel,
                section = section,
                birthday = birthday,
                pin = pin,
                profileImageUri = profileImageUri
            )
            onSaved(saved)
        }
    }

    fun updateProfileImage(studentId: String, profileImageUri: String) {
        viewModelScope.launch {
            container.studentRepository.updateProfileImage(studentId, profileImageUri)
        }
    }

    fun markLessonRead(studentId: String, moduleId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            container.studentRepository.markLessonRead(studentId, moduleId)
            onDone()
        }
    }

    fun markModuleDone(studentId: String, moduleId: String) {
        viewModelScope.launch {
            container.studentRepository.markModuleDone(studentId, moduleId)
        }
    }

    fun studentRecord(studentId: String) = container.teacherRepository.recordForStudent(studentId)

    fun attemptsForStudent(studentId: String) = container.teacherRepository.attemptsForStudent(studentId)

    suspend fun submitQuiz(studentId: String, moduleId: String, answers: Map<String, String>, durationSeconds: Long): QuizResult {
        val result = container.quizRepository.submitQuiz(studentId, moduleId, answers, durationSeconds)
        _lastQuizResult.value = result
        return result
    }

    suspend fun exportProgress(studentId: String): String {
        val result = container.syncRepository.exportStudentProgress(studentId)
        _syncMessage.value = "Progress JSON generated locally."
        return result
    }

    fun importProgress(rawJson: String) {
        viewModelScope.launch {
            _syncMessage.value = container.syncRepository.importStudentProgress(rawJson)
        }
    }

    fun importTeacherScan(rawJson: String) {
        viewModelScope.launch {
            _syncMessage.value = container.syncRepository.importTeacherScan(rawJson)
        }
    }

    fun importStudentScan(rawJson: String) {
        viewModelScope.launch {
            _syncMessage.value = container.syncRepository.importStudentScan(rawJson)
        }
    }

    fun formatQrPayload(rawJson: String): String = container.syncRepository.formatQrPayload(rawJson)

    suspend fun bestQuizResultJson(studentId: String, moduleId: String): String =
        container.syncRepository.exportBestQuizResult(studentId, moduleId)

    fun studentProfileJson(
        studentId: String,
        studentNumber: String,
        firstName: String,
        lastName: String,
        middleInitial: String,
        gradeLevel: Int,
        section: String,
        birthday: String
    ): String =
        container.syncRepository.studentProfileJson(studentId, studentNumber, firstName, lastName, middleInitial, gradeLevel, section, birthday)

    fun addTextMaterial(studentId: String, sourceName: String, rawText: String, onAdded: (String) -> Unit = {}) {
        viewModelScope.launch {
            val module = container.moduleRepository.addTextMaterialForStudent(studentId, sourceName, rawText)
            _syncMessage.value = "Added ${module.title} to Added Materials."
            onAdded(module.title)
        }
    }

    fun lessonName(subject: String, gradeLevel: Int, quarter: Int, moduleNumber: Int): String =
        curriculumTopic(subject, gradeLevel, quarter, moduleNumber)

    fun maxModuleFor(subject: String, gradeLevel: Int, quarter: Int): Int {
        return when (subject.uppercase()) {
            "MATH" -> if (gradeLevel <= 6) 10 else 8
            "SCIENCE" -> if (quarter in 1..2) 8 else 6
            "ENGLISH" -> 8
            else -> 6
        }
    }

    fun curriculumTopic(subject: String, gradeLevel: Int, quarter: Int, moduleNumber: Int): String {
        val topics = when (subject.uppercase()) {
            "SCIENCE" -> listOf("Properties of Materials", "Changes in Matter", "Body Systems", "Ecosystems", "Weather Patterns", "Earth and Space", "Force and Motion", "Simple Machines")
            "MATH" -> listOf("Number Sense", "Adding and Subtracting Fractions", "Multiplying Fractions", "Decimals", "Geometry", "Measurement", "Data and Graphs", "Patterns", "Problem Solving", "Financial Literacy")
            "ENGLISH" -> listOf("Main Idea and Supporting Details", "Context Clues", "Fact and Opinion", "Text Structure", "Writing Paragraphs", "Oral Presentation", "Viewing Comprehension", "Grammar in Context")
            else -> listOf("Core Lesson")
        }
        val offset = ((quarter - 1).coerceAtLeast(0) * 2 + (moduleNumber - 1).coerceAtLeast(0)) % topics.size
        return "Grade $gradeLevel ${topics[offset]}"
    }

    fun generateLesson(input: GurobotInput) {
        viewModelScope.launch {
            _gurobotResponse.value = GurobotResponse("Generating lesson draft...", "Working")
            _gurobotResponse.value = container.gurobotRepository.generate(input)
        }
    }

    fun saveGeneratedLesson(input: GurobotInput, content: String) {
        viewModelScope.launch {
            container.teacherRepository.saveLessonPlan(
                LessonPlanEntity(
                    id = "plan_${UUID.randomUUID()}",
                    title = "${input.subject}: ${input.topic}",
                    subject = input.subject.uppercase(),
                    gradeLevel = input.gradeLevel,
                    competencyCode = input.competencyCode,
                    topic = input.topic,
                    generatedContent = content,
                    createdAt = System.currentTimeMillis()
                )
            )
            container.syncRepository.saveTeacherModule(input, content)
            _gurobotResponse.value = GurobotResponse(content, "Saved locally")
        }
    }

    fun assessStudentPerformance(row: RecordBookRow) {
        viewModelScope.launch {
            val attempts = container.teacherRepository.attemptsForStudent(row.studentId).first()
            _studentAssessment.value = container.gurobotRepository.assessStudent(row, attempts)
        }
    }

    class Factory(private val container: AppContainer) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return LearningHubViewModel(container) as T
        }
    }
}
