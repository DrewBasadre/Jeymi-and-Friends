package com.pangarap.learninghub.ui.screens

import android.Manifest
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.google.zxing.BinaryBitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import com.google.zxing.qrcode.QRCodeWriter
import com.pangarap.learninghub.data.local.ModuleEntity
import com.pangarap.learninghub.data.local.QuizAttemptEntity
import com.pangarap.learninghub.data.local.QuizQuestionEntity
import com.pangarap.learninghub.data.local.StudentEntity
import com.pangarap.learninghub.domain.GurobotInput
import com.pangarap.learninghub.domain.QuestionType
import com.pangarap.learninghub.domain.RecordBookRow
import com.pangarap.learninghub.domain.SubjectType
import com.pangarap.learninghub.ui.LearningHubViewModel
import java.io.File
import java.util.concurrent.Executors
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.unit.sp
import com.pangarap.learninghub.ui.screens.AppBrandHeader
import com.pangarap.learninghub.ui.screens.HubMetricCard
import com.pangarap.learninghub.ui.screens.HubPrimaryButton
import com.pangarap.learninghub.ui.screens.HubSecondaryButton
import com.pangarap.learninghub.ui.screens.HubSectionTitle
import com.pangarap.learninghub.ui.screens.InitialAvatar
import com.pangarap.learninghub.ui.screens.MetricTint
import com.pangarap.learninghub.ui.screens.OfflineBadge
import com.pangarap.learninghub.ui.screens.StatusChip
import com.pangarap.learninghub.ui.screens.subjectAccentColor
import com.pangarap.learninghub.ui.theme.Amber50
import com.pangarap.learninghub.ui.theme.ElevationCard
import com.pangarap.learninghub.ui.theme.Indigo500
import com.pangarap.learninghub.ui.theme.Indigo900
import com.pangarap.learninghub.ui.theme.MetricBlueBg
import com.pangarap.learninghub.ui.theme.OnSurface
import com.pangarap.learninghub.ui.theme.OnSurfaceVariant
import com.pangarap.learninghub.ui.theme.OutlineVariant
import com.pangarap.learninghub.ui.theme.ShapeButton
import com.pangarap.learninghub.ui.theme.ShapeCard
import com.pangarap.learninghub.ui.theme.SpacingGap
import com.pangarap.learninghub.ui.theme.SpacingLg
import com.pangarap.learninghub.ui.theme.SpacingMd
import com.pangarap.learninghub.ui.theme.SpacingSm
import com.pangarap.learninghub.ui.theme.SpacingXl
import com.pangarap.learninghub.ui.theme.SpacingXs
import com.pangarap.learninghub.ui.theme.SpacingXxl
import com.pangarap.learninghub.ui.theme.SubjectEnglishBg
import com.pangarap.learninghub.ui.theme.Surface
import com.pangarap.learninghub.ui.theme.SurfaceLow
import com.pangarap.learninghub.ui.theme.SurfaceLowest
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

private val CoreSubjectTypes = listOf(SubjectType.SCIENCE, SubjectType.MATH, SubjectType.ENGLISH)
private val ModuleSubjectTypes = SubjectType.entries.toList()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HubScaffold(
    title: String,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
    bottomBar: @Composable () -> Unit = {},
    floatingActionButton: @Composable () -> Unit = {},
    content: @Composable (Modifier) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        title,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                navigationIcon = {
                    if (onBack != null) {
                        TextButton(
                            onClick = onBack,
                            modifier = Modifier.padding(start = 4.dp)
                        ) {
                            Text(
                                "← Back",
                                color = Indigo500,
                                style = MaterialTheme.typography.labelLarge
                            )
                        }
                    }
                },
                actions = actions,
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Surface,
                    titleContentColor = Indigo900
                )
            )
        },
        bottomBar = bottomBar,
        floatingActionButton = floatingActionButton,
        containerColor = Surface
    ) { padding ->
        content(
            Modifier
                .padding(padding)
                .fillMaxSize()
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    HubSectionTitle(text = text)
}

@Composable
private fun MetricCard(label: String, value: String, modifier: Modifier = Modifier) {
    HubMetricCard(label = label, value = value, modifier = modifier)
}

@Composable
private fun FormattedText(text: String, modifier: Modifier = Modifier) {
    val lines = remember(text) { text.lines() }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        lines.forEach { rawLine ->
            val line = rawLine.trim().removeMarkdownHeadingPrefix()
            when {
                line.isBlank() -> Spacer(Modifier.height(4.dp))
                isSectionHeading(line) -> Text(
                    line.trimEnd(':'),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = Indigo900
                )
                line.startsWith("- ") || line.startsWith("* ") -> Text(
                    "• ${line.drop(2).trim()}",
                    style = MaterialTheme.typography.bodyLarge,
                    color = OnSurface
                )
                line.matches(Regex("""\d+\.\s+.*""")) -> Text(
                    line,
                    style = MaterialTheme.typography.bodyLarge,
                    color = OnSurface
                )
                else -> Text(
                    line,
                    style = MaterialTheme.typography.bodyLarge,
                    color = OnSurface
                )
            }
        }
    }
}

private fun String.removeMarkdownHeadingPrefix(): String =
    replace(Regex("^#{1,6}\\s+"), "")

private fun isSectionHeading(line: String): Boolean {
    val normalized = line.trim().trimEnd(':')
    if (line.endsWith(":") && normalized.length <= 40) return true
    return normalized in setOf(
        "Student Information",
        "Quiz Result",
        "Teacher Module",
        "Progress Export",
        "Objectives",
        "Key Idea",
        "Materials",
        "Daily Lesson Log",
        "Learner Activity Sheet",
        "Differentiation",
        "Assessment",
        "Remediation",
        "Teacher Notes"
    )
}

private fun moduleLibraryPreview(content: String): String {
    val preview = content
        .lines()
        .map { it.trim().removeMarkdownHeadingPrefix() }
        .filter { it.isNotBlank() }
        .take(9)
        .joinToString("\n") { line ->
            when {
                line.endsWith(":") -> line
                line.startsWith("- ") || line.startsWith("* ") -> "- ${line.drop(2).trim()}"
                else -> line
            }
        }
        .trim()
    return if (preview.length > 560) "${preview.take(560)}..." else preview
}

private fun shareGurobotLessonText(context: Context, input: GurobotInput, content: String) {
    val lessonTitle = input.topic.ifBlank { input.competencyCode }.ifBlank { "Gurobot Lesson" }
    val shareDir = File(context.cacheDir, "shared_lessons").apply { mkdirs() }
    val file = File(shareDir, "${safeFileName(lessonTitle)}.txt")
    file.writeText(gurobotTextFile(input, lessonTitle, content), Charsets.UTF_8)

    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val sendIntent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, lessonTitle)
        putExtra(Intent.EXTRA_TITLE, lessonTitle)
        clipData = ClipData.newRawUri(lessonTitle, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(sendIntent, "Share lesson text via Bluetooth"))
}

private fun gurobotTextFile(input: GurobotInput, lessonTitle: String, content: String): String {
    return """
        Lesson Title: $lessonTitle
        Subject: ${SubjectType.fromName(input.subject).label}
        Grade Level: ${input.gradeLevel}
        Quarter: ${input.quarter}
        Module: ${input.moduleNumber}

        ${content.trim()}
    """.trimIndent()
}

private fun safeFileName(value: String): String {
    return value
        .replace(Regex("[^A-Za-z0-9._ -]+"), "_")
        .replace(Regex("\\s+"), " ")
        .trim(' ', '.', '_')
        .ifBlank { "Gurobot Lesson" }
        .take(80)
}

private fun readTextFromUri(context: Context, uri: Uri): String? {
    return runCatching {
        context.contentResolver.openInputStream(uri)
            ?.bufferedReader(Charsets.UTF_8)
            ?.use { it.readText() }
            ?.trim()
            ?.takeIf { it.isNotBlank() }
    }.getOrNull()
}

private fun displayNameFromUri(context: Context, uri: Uri): String {
    val queried = runCatching {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor ->
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
            }
    }.getOrNull()
    return queried?.takeIf { it.isNotBlank() }
        ?: uri.lastPathSegment?.substringAfterLast('/')?.takeIf { it.isNotBlank() }
        ?: "added-material.txt"
}

@Composable
fun RoleSelectionScreen(onStudent: () -> Unit, onTeacher: () -> Unit) {
    Scaffold(containerColor = Surface) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .padding(horizontal = SpacingXl, vertical = SpacingGap),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            AppBrandHeader()
            Spacer(Modifier.height(SpacingGap))
            // Student card
            Card(
                onClick = onStudent,
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(ElevationCard, ShapeCard),
                shape = ShapeCard,
                colors = CardDefaults.cardColors(containerColor = SurfaceLowest)
            ) {
                Row(
                    Modifier.padding(SpacingXl),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(SpacingLg)
                ) {
                    Box(
                        Modifier
                            .size(52.dp)
                            .background(MetricBlueBg, RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center
                    ) { Text("🎒", fontSize = 26.sp) }
                    Column(Modifier.weight(1f)) {
                        Text("Student", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Indigo900)
                        Text("Access your modules and quizzes", style = MaterialTheme.typography.bodyMedium, color = OnSurfaceVariant)
                    }
                    Text("›", fontSize = 22.sp, color = Indigo500, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(SpacingMd))
            // Teacher card
            Card(
                onClick = onTeacher,
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(ElevationCard, ShapeCard),
                shape = ShapeCard,
                colors = CardDefaults.cardColors(containerColor = SurfaceLowest)
            ) {
                Row(
                    Modifier.padding(SpacingXl),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(SpacingLg)
                ) {
                    Box(
                        Modifier
                            .size(52.dp)
                            .background(SubjectEnglishBg, RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center
                    ) { Text("🏫", fontSize = 26.sp) }
                    Column(Modifier.weight(1f)) {
                        Text("Teacher", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Indigo900)
                        Text("Manage class, modules, and records", style = MaterialTheme.typography.bodyMedium, color = OnSurfaceVariant)
                    }
                    Text("›", fontSize = 22.sp, color = Indigo500, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(SpacingXxl))
            Text(
                "DepEd K-12 Curriculum",
                style = MaterialTheme.typography.labelMedium,
                color = OnSurfaceVariant
            )
            Spacer(Modifier.height(SpacingSm))
            OfflineBadge()
        }
    }
}

@Composable
fun StudentLoginScreen(
    viewModel: LearningHubViewModel,
    onBack: () -> Unit,
    onOpenStudent: (String) -> Unit,
    onCreateInfoQr: () -> Unit
) {
    val students by viewModel.students.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var identifier by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    HubScaffold(title = "Student Login", onBack = onBack) { modifier ->
        Column(
            modifier = modifier
                .padding(horizontal = SpacingXl)
                .fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            InitialAvatar(initial = "S", size = 64.dp)
            Spacer(Modifier.height(SpacingMd))
            Text(
                "Welcome Back, Scholar!",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Indigo900
            )
            Text(
                "Sign in to continue learning",
                style = MaterialTheme.typography.bodyMedium,
                color = OnSurfaceVariant
            )
            Spacer(Modifier.height(SpacingGap))
            OutlinedTextField(
                value = identifier,
                onValueChange = { identifier = it },
                label = { Text("Student Number or Last Name") },
                singleLine = true,
                shape = ShapeCard,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(SpacingMd))
            OutlinedTextField(
                value = pin,
                onValueChange = { pin = it },
                label = { Text("PIN") },
                singleLine = true,
                shape = ShapeCard,
                modifier = Modifier.fillMaxWidth()
            )
            if (error.isNotBlank()) {
                Spacer(Modifier.height(SpacingSm))
                Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(SpacingLg))
            HubPrimaryButton(
                text = "Login",
                onClick = {
                    scope.launch {
                        val student = viewModel.loginStudent(identifier, pin)
                        if (student == null) error = "Login failed. Check student number/last name and PIN."
                        else { error = ""; onOpenStudent(student.id) }
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(SpacingMd))
            StudentProfileMenu(
                students = students,
                onPick = onOpenStudent,
                onCreateInfoQr = onCreateInfoQr,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(SpacingXxl))
            OfflineBadge()
        }
    }
}

@Composable
private fun StudentProfileMenu(
    students: List<StudentEntity>,
    onPick: (String) -> Unit,
    onCreateInfoQr: () -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier, contentAlignment = Alignment.Center) {
        OutlinedButton(onClick = { expanded = true }) {
            Text("Student Menu")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("Create Student Info QR") },
                onClick = {
                    expanded = false
                    onCreateInfoQr()
                }
            )
            students.forEach { student ->
                DropdownMenuItem(
                    text = { Text("${student.name} (${student.studentNumber})") },
                    onClick = {
                        expanded = false
                        onPick(student.id)
                    }
                )
            }
        }
    }
}

@Composable
fun TeacherLoginScreen(
    viewModel: LearningHubViewModel,
    onBack: () -> Unit,
    onLogin: () -> Unit
) {
    var teacherNumber by remember { mutableStateOf("T-1001") }
    var teacherName by remember { mutableStateOf("Teacher") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    HubScaffold(title = "Teacher Login", onBack = onBack) { modifier ->
        Column(
            modifier
                .padding(horizontal = SpacingXl)
                .fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                Modifier
                    .size(72.dp)
                    .background(
                        brush = androidx.compose.ui.graphics.Brush.linearGradient(
                            listOf(com.pangarap.learninghub.ui.theme.Emerald500, com.pangarap.learninghub.ui.theme.Emerald600)
                        ),
                        shape = RoundedCornerShape(20.dp)
                    ),
                contentAlignment = Alignment.Center
            ) { Text("🛡", fontSize = 32.sp) }
            Spacer(Modifier.height(SpacingMd))
            Text(
                "Teacher Portal",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Indigo900
            )
            Text(
                "Sign in to manage your class",
                style = MaterialTheme.typography.bodyMedium,
                color = OnSurfaceVariant
            )
            Spacer(Modifier.height(SpacingGap))
            OutlinedTextField(
                value = teacherNumber,
                onValueChange = { teacherNumber = it },
                label = { Text("Teacher Number") },
                singleLine = true,
                shape = ShapeCard,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(SpacingMd))
            OutlinedTextField(
                value = teacherName,
                onValueChange = { teacherName = it },
                label = { Text("Teacher Name") },
                singleLine = true,
                shape = ShapeCard,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(SpacingMd))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                shape = ShapeCard,
                modifier = Modifier.fillMaxWidth()
            )
            if (error.isNotBlank()) {
                Spacer(Modifier.height(SpacingSm))
                Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(SpacingLg))
            HubPrimaryButton(
                text = "Login",
                onClick = {
                    if (viewModel.loginTeacher(teacherNumber, password, teacherName)) { error = ""; onLogin() }
                    else error = "Login failed. Check teacher number and password."
                },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(SpacingXxl))
            OfflineBadge()
        }
    }
}

@Composable
fun StudentDashboardScreen(
    viewModel: LearningHubViewModel,
    studentId: String,
    onBack: () -> Unit,
    onModules: () -> Unit,
    onQrCode: () -> Unit,
    onProfile: () -> Unit
) {
    val flow = remember(studentId) { viewModel.studentDashboard(studentId) }
    val summary by flow.collectAsState(initial = null)
    val modules by remember { viewModel.modulesForGrade(5) }.collectAsState(initial = emptyList())
    val attempts by remember(studentId) { viewModel.attemptsForStudent(studentId) }.collectAsState(initial = emptyList())
    val progress by remember(studentId) { viewModel.progressForStudent(studentId) }.collectAsState(initial = emptyList())
    var selectedSubject by remember { mutableStateOf(SubjectType.SCIENCE) }
    HubScaffold(
        title = "Student Dashboard",
        onBack = onBack,
        bottomBar = { StudentBottomMenu("dashboard", onModules, onQrCode, onProfile) }
    ) { modifier ->
        val data = summary
        if (data == null) {
            Box(modifier, contentAlignment = Alignment.Center) { Text("Loading profile...") }
        } else {
            Column(
                modifier = modifier
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    "Hi, ${data.firstName}!",
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.ExtraBold,
                    color = Indigo900
                )
                Text(
                    "Grade ${data.gradeLevel} · ${data.section}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = OnSurfaceVariant
                )
                PeacockMeter(
                    completedModules = progress.count { it.status == "COMPLETED" },
                    totalModules = modules.size,
                    averageScore = averagePercent(attempts).toInt()
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ModuleSubjectTypes.forEach { subject ->
                        FilterChip(
                            selected = selectedSubject == subject,
                            onClick = { selectedSubject = subject },
                            label = { Text(subject.label) }
                        )
                    }
                }
                val subjectModuleIds = modules.filter { it.subject == selectedSubject.name }.map { it.id }.toSet()
                val subjectAttempts = attempts.filter { it.moduleId in subjectModuleIds }
                val subjectCompleted = progress.count { it.moduleId in subjectModuleIds && it.status == "COMPLETED" }
                Row(horizontalArrangement = Arrangement.spacedBy(SpacingMd), modifier = Modifier.fillMaxWidth()) {
                    HubMetricCard("Average", "${averagePercent(subjectAttempts)}%", MetricTint.Blue, Modifier.weight(1f))
                    HubMetricCard("Completion", "${completionPercent(subjectCompleted, subjectModuleIds.size)}%", MetricTint.Green, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(SpacingMd), modifier = Modifier.fillMaxWidth()) {
                    HubMetricCard("Modules", "$subjectCompleted/${subjectModuleIds.size}", MetricTint.Purple, Modifier.weight(1f))
                    HubMetricCard("Attempts", "${subjectAttempts.size}", MetricTint.Amber, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(SpacingMd), modifier = Modifier.fillMaxWidth()) {
                    HubMetricCard("Last Quiz Time", formatDuration(data.lastQuizDurationSeconds), MetricTint.Blue, Modifier.weight(1f))
                    HubMetricCard("Strong Area", data.strongTopic.lowercase().replaceFirstChar { it.uppercase() }, MetricTint.Green, Modifier.weight(1f))
                }
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = ShapeCard,
                    colors = CardDefaults.cardColors(containerColor = com.pangarap.learninghub.ui.theme.Amber50)
                ) {
                    Column(Modifier.padding(SpacingLg)) {
                        Text("Current Weak Topic", fontWeight = FontWeight.Bold, color = Indigo900)
                        Text(data.weakTopic, color = OnSurfaceVariant)
                    }
                }
                HorizontalDivider()
                ModuleSubjectTypes.forEach { subject ->
                    Card(onClick = {
                        selectedSubject = subject
                        onModules()
                    }, modifier = Modifier.fillMaxWidth()) {
                        Text(subject.label, modifier = Modifier.padding(16.dp), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun StudentBottomMenu(
    selected: String,
    onModules: () -> Unit,
    onQrCode: () -> Unit,
    onProfile: () -> Unit
) {
    NavigationBar(containerColor = SurfaceLowest) {
        NavigationBarItem(
            selected = selected == "dashboard",
            onClick = onModules,
            icon = { Text("📚", fontSize = 18.sp) },
            label = { Text("Modules", style = MaterialTheme.typography.labelSmall) }
        )
        NavigationBarItem(
            selected = selected == "qr",
            onClick = onQrCode,
            icon = { Text("⬛", fontSize = 18.sp) },
            label = { Text("QR Code", style = MaterialTheme.typography.labelSmall) }
        )
        NavigationBarItem(
            selected = selected == "profile",
            onClick = onProfile,
            icon = { Text("👤", fontSize = 18.sp) },
            label = { Text("Profile", style = MaterialTheme.typography.labelSmall) }
        )
    }
}

@Composable
fun StudentInfoQrScreen(
    viewModel: LearningHubViewModel,
    studentId: String,
    onBack: () -> Unit
) {
    val existingStudent by if (studentId == "new") {
        remember { mutableStateOf<StudentEntity?>(null) }
    } else {
        remember(studentId) { viewModel.observeStudent(studentId) }.collectAsState(initial = null)
    }
    var didPrefill by remember { mutableStateOf(false) }
    var studentNumber by remember { mutableStateOf("") }
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var middleInitial by remember { mutableStateOf("") }
    var gradeLevelText by remember { mutableStateOf("5") }
    var section by remember { mutableStateOf("Mabini") }
    var birthday by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var payload by remember { mutableStateOf("") }
    var savedMessage by remember { mutableStateOf("") }

    LaunchedEffect(existingStudent?.id) {
        val student = existingStudent
        if (!didPrefill && student != null) {
            studentNumber = student.studentNumber
            firstName = student.firstName
            lastName = student.lastName
            middleInitial = student.middleInitial
            gradeLevelText = student.gradeLevel.toString()
            section = student.section
            birthday = student.birthday
            pin = student.pin
            didPrefill = true
        }
    }

    HubScaffold(title = "Student Information QR", onBack = onBack) { modifier ->
        Column(
            modifier
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(studentNumber, { studentNumber = it }, label = { Text("Student Number") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(firstName, { firstName = it }, label = { Text("First Name") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(lastName, { lastName = it }, label = { Text("Last Name") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(middleInitial, { middleInitial = it.take(1) }, label = { Text("Middle Initial") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(birthday, { birthday = it }, label = { Text("Birthday") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(gradeLevelText, { gradeLevelText = it.filter(Char::isDigit) }, label = { Text("Grade") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(section, { section = it }, label = { Text("Section") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(pin, { pin = it }, label = { Text("PIN") }, modifier = Modifier.fillMaxWidth())
            Button(
                onClick = {
                    viewModel.saveStudentProfile(
                        studentId = if (studentId == "new") null else studentId,
                        studentNumber = studentNumber,
                        firstName = firstName,
                        lastName = lastName,
                        middleInitial = middleInitial,
                        gradeLevel = gradeLevelText.toIntOrNull() ?: 5,
                        section = section,
                        birthday = birthday,
                        pin = pin
                    ) { saved ->
                        payload = viewModel.studentProfileJson(
                            studentId = saved.id,
                            studentNumber = saved.studentNumber,
                            firstName = saved.firstName,
                            lastName = saved.lastName,
                            middleInitial = saved.middleInitial,
                            gradeLevel = saved.gradeLevel,
                            section = saved.section,
                            birthday = saved.birthday
                        )
                        savedMessage = "Saved SIS profile. Use Student Number or Last Name with this PIN to log in."
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Save and Generate Student Info QR")
            }
            if (savedMessage.isNotBlank()) Text(savedMessage, fontWeight = FontWeight.Bold)
            if (payload.isNotBlank()) {
                QrCodeImage(payload = payload, modifier = Modifier.align(Alignment.CenterHorizontally))
            }
        }
    }
}

@Composable
fun ModuleLibraryScreen(
    viewModel: LearningHubViewModel,
    studentId: String,
    onBack: () -> Unit,
    onStartLesson: (String) -> Unit,
    onTakeQuiz: (String) -> Unit
) {
    val modules by remember { viewModel.modulesForGrade(5) }.collectAsState(initial = emptyList())
    val progress by remember(studentId) { viewModel.progressForStudent(studentId) }.collectAsState(initial = emptyList())
    val attempts by remember(studentId) { viewModel.attemptsForStudent(studentId) }.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    val resultQrs = remember(studentId) { mutableStateMapOf<String, String>() }
    val context = LocalContext.current
    var selected by remember { mutableStateOf(SubjectType.SCIENCE) }
    var importMessage by remember { mutableStateOf("") }
    val textFileLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val text = readTextFromUri(context, uri)
        if (text.isNullOrBlank()) {
            importMessage = "Could not read that text file."
            return@rememberLauncherForActivityResult
        }
        viewModel.addTextMaterial(studentId, displayNameFromUri(context, uri), text) { title ->
            selected = SubjectType.ADDED_MATERIALS
            importMessage = "Added \"$title\" to Added Materials."
        }
    }
    HubScaffold(title = "Module Library", onBack = onBack) { modifier ->
        Column(modifier.padding(16.dp)) {
            ScrollableTabRow(selectedTabIndex = ModuleSubjectTypes.indexOf(selected), edgePadding = 0.dp) {
                ModuleSubjectTypes.forEach { subject ->
                    Tab(
                        selected = selected == subject,
                        onClick = { selected = subject },
                        text = { Text(subject.label) }
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            if (selected == SubjectType.ADDED_MATERIALS) {
                OutlinedButton(
                    onClick = { textFileLauncher.launch(arrayOf("text/plain", "text/*")) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Add Text File")
                }
                if (importMessage.isNotBlank()) {
                    Text(importMessage, style = MaterialTheme.typography.bodySmall, color = OnSurfaceVariant)
                }
                Spacer(Modifier.height(12.dp))
            }
            val subjectModules = modules
                .filter { it.subject == selected.name }
                .sortedWith(compareBy<ModuleEntity> { moduleNumber(it) }.thenBy { it.isTeacherCreated }.thenBy { it.title })
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(subjectModules, key = { it.id }) { module ->
                    val moduleProgress = progress.firstOrNull { it.moduleId == module.id }
                    val moduleAttempts = attempts.filter { it.moduleId == module.id }
                    ModuleCard(
                        module = module,
                        status = moduleProgress?.status.orEmpty(),
                        attempts = moduleAttempts,
                        qrPayload = resultQrs[module.id].orEmpty(),
                        onStartLesson = { onStartLesson(module.id) },
                        onTakeQuiz = { onTakeQuiz(module.id) },
                        onMarkDone = { viewModel.markModuleDone(studentId, module.id) },
                        onGenerateQr = {
                            scope.launch {
                                resultQrs[module.id] = viewModel.bestQuizResultJson(studentId, module.id)
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun ModuleCard(
    module: ModuleEntity,
    status: String,
    attempts: List<QuizAttemptEntity>,
    qrPayload: String,
    onStartLesson: () -> Unit,
    onTakeQuiz: () -> Unit,
    onMarkDone: () -> Unit,
    onGenerateQr: () -> Unit
) {
    val number = moduleNumber(module)
    val subject = SubjectType.fromName(module.subject).label
    val isAddedMaterial = module.subject == SubjectType.ADDED_MATERIALS.name
    val title = when {
        isAddedMaterial -> "Added Material: ${module.title}"
        module.isTeacherCreated -> "Additional Module $number: ${module.title}"
        else -> "Module $number: ${module.title}"
    }
    val completed = status == "COMPLETED"
    val lessonRead = status == "IN_PROGRESS" || completed || attempts.isNotEmpty()
    val best = attempts.maxWithOrNull(
        compareBy<QuizAttemptEntity> { it.score.toDouble() / it.totalItems.coerceAtLeast(1) }.thenBy { it.submittedAt }
    )
    val accentColor = subjectAccentColor(module.subject)
    val cardBg = if (completed) com.pangarap.learninghub.ui.theme.SurfaceLow else SurfaceLowest
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(ElevationCard, ShapeCard),
        shape = ShapeCard,
        colors = CardDefaults.cardColors(containerColor = cardBg)
    ) {
        Row(Modifier.height(IntrinsicSize.Min)) {
            // Left accent border — height tracks the Row via IntrinsicSize
            Box(
                Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(accentColor)
            )
            Column(
                Modifier.padding(SpacingLg),
                verticalArrangement = Arrangement.spacedBy(SpacingSm)
            ) {
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            title,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleMedium,
                            color = Indigo900
                        )
                        Text(
                            "MELC Code: ${module.competencyCode.ifBlank { module.title }}",
                            style = MaterialTheme.typography.labelMedium,
                            color = OnSurfaceVariant
                        )
                        Text(
                            "Quarter ${module.quarter} · $subject",
                            style = MaterialTheme.typography.bodySmall,
                            color = OnSurfaceVariant
                        )
                    }
                    StatusChip(status)
                }
                Text(
                    moduleLibraryPreview(module.content),
                    style = MaterialTheme.typography.bodyMedium,
                    color = OnSurface,
                    maxLines = 7,
                    overflow = TextOverflow.Ellipsis
                )
                Row(horizontalArrangement = Arrangement.spacedBy(SpacingSm), modifier = Modifier.fillMaxWidth()) {
                    HubPrimaryButton(
                        text = when {
                            isAddedMaterial -> "Open Material"
                            lessonRead -> "Re-read"
                            else -> "Start Lesson"
                        },
                        onClick = onStartLesson,
                        modifier = Modifier.weight(1f)
                    )
                    if (lessonRead && !isAddedMaterial) {
                        HubSecondaryButton(
                            text = if (attempts.size >= 2) "Used" else "Quiz",
                            onClick = onTakeQuiz,
                            enabled = attempts.size < 2,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                if (best != null && !isAddedMaterial) {
                    Text(
                        "Best: ${best.score}/${best.totalItems} · ${attempts.size.coerceAtMost(2)}/2 attempts",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Indigo500
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(SpacingSm), modifier = Modifier.fillMaxWidth()) {
                        HubSecondaryButton(
                            text = if (completed) "Done ✓" else "Mark Done",
                            onClick = onMarkDone,
                            enabled = !completed,
                            modifier = Modifier.weight(1f)
                        )
                        HubSecondaryButton(
                            text = "Gen QR",
                            onClick = onGenerateQr,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                if (qrPayload.isNotBlank()) {
                    QrCodeImage(payload = qrPayload, modifier = Modifier.align(Alignment.CenterHorizontally))
                }
            }
        }
    }
}

@Composable
fun DigitalLessonScreen(
    viewModel: LearningHubViewModel,
    studentId: String,
    moduleId: String,
    onBackToModules: () -> Unit
) {
    val module by remember(moduleId) { viewModel.observeModule(moduleId) }.collectAsState(initial = null)
    val isAddedMaterial = module?.subject == SubjectType.ADDED_MATERIALS.name
    HubScaffold(title = if (isAddedMaterial) "Added Material" else "DepEd Digital Module", onBack = onBackToModules) { modifier ->
        val data = module
        if (data == null) {
            Box(modifier, contentAlignment = Alignment.Center) { Text("Loading module...") }
        } else {
            val pages = lessonPages(data)
            val pagerState = rememberPagerState(pageCount = { pages.size })
            Column(modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(data.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Page ${pagerState.currentPage + 1} of ${pages.size}", color = Color(0xFF64748B))
                HorizontalPager(state = pagerState, modifier = Modifier.weight(1f)) { page ->
                    Card(modifier = Modifier.fillMaxSize()) {
                        Column(
                            Modifier
                                .verticalScroll(rememberScrollState())
                                .padding(18.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(if (isAddedMaterial) data.title else "DepEd Module Page ${page + 1}", fontWeight = FontWeight.Bold)
                            FormattedText(pages[page])
                        }
                    }
                }
                Button(
                    onClick = { viewModel.markLessonRead(studentId, moduleId, onBackToModules) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("End Lesson")
                }
            }
        }
    }
}

@Composable
fun LessonScreen(
    viewModel: LearningHubViewModel,
    studentId: String,
    moduleId: String,
    onBack: () -> Unit,
    onStartQuiz: () -> Unit,
    onMarkedDone: () -> Unit
) {
    val module by remember(moduleId) { viewModel.observeModule(moduleId) }.collectAsState(initial = null)
    val completed by remember(studentId, moduleId) { viewModel.hasCompletedAssessment(studentId, moduleId) }.collectAsState(initial = false)
    HubScaffold(title = "Lesson", onBack = onBack) { modifier ->
        val data = module
        if (data == null) {
            Box(modifier, contentAlignment = Alignment.Center) { Text("Loading lesson...") }
        } else {
            Column(
                modifier
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(data.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                AssistChip(onClick = {}, label = { Text("Lesson Name: ${data.competencyCode.ifBlank { data.title }}") })
                FormattedText(data.content)
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF))) {
                    Text(
                        "Assessment required before this module can be marked done.",
                        modifier = Modifier.padding(16.dp)
                    )
                }
                Button(onClick = onStartQuiz, modifier = Modifier.fillMaxWidth()) {
                    Text(if (completed) "Retake Quiz" else "Start Quiz")
                }
                OutlinedButton(onClick = onMarkedDone, modifier = Modifier.fillMaxWidth(), enabled = completed) {
                    Text(if (completed) "Mark as Done" else "Complete Assessment First")
                }
            }
        }
    }
}

@Composable
fun LessonPreviewScreen(
    viewModel: LearningHubViewModel,
    moduleId: String,
    onBack: () -> Unit
) {
    val module by remember(moduleId) { viewModel.observeModule(moduleId) }.collectAsState(initial = null)
    HubScaffold(title = "Student View", onBack = onBack) { modifier ->
        val data = module
        if (data == null) {
            Box(modifier, contentAlignment = Alignment.Center) { Text("Loading lesson...") }
        } else {
            Column(
                modifier
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(data.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                AssistChip(onClick = {}, label = { Text("Lesson Name: ${data.competencyCode.ifBlank { data.title }}") })
                FormattedText(data.content)
            }
        }
    }
}

@Composable
fun QuizScreen(
    viewModel: LearningHubViewModel,
    studentId: String,
    moduleId: String,
    onBack: () -> Unit,
    onFinished: () -> Unit
) {
    val questions by remember(moduleId) { viewModel.questionsForModule(moduleId) }.collectAsState(initial = emptyList())
    val priorAttempts by remember(studentId, moduleId) { viewModel.attemptsForModule(studentId, moduleId) }.collectAsState(initial = emptyList())
    val answers = remember(moduleId) { mutableStateMapOf<String, String>() }
    val startedAt = remember(moduleId) { System.currentTimeMillis() }
    val scope = rememberCoroutineScope()
    val isComplete = questions.isNotEmpty() && questions.all { answers[it.id]?.isNotBlank() == true }
    HubScaffold(title = "Quiz", onBack = onBack) { modifier ->
        if (priorAttempts.size >= 2) {
            Column(
                modifier
                    .padding(16.dp)
                    .fillMaxSize(),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("Maximum attempts reached.", fontWeight = FontWeight.Bold)
                Text("Return to the module library to generate the QR for the best score.")
                Spacer(Modifier.height(16.dp))
                Button(onClick = onFinished, modifier = Modifier.fillMaxWidth()) { Text("Back to Module") }
            }
            return@HubScaffold
        }
        Column(modifier.padding(16.dp)) {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.weight(1f)) {
                items(questions, key = { it.id }) { question ->
                    QuestionCard(question = question, answer = answers[question.id].orEmpty()) {
                        answers[question.id] = it
                    }
                }
            }
            if (!isComplete) {
                Text("Answer all items before submitting.", color = Color(0xFF92400E), fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
            }
            Button(
                onClick = {
                    scope.launch {
                        val durationSeconds = ((System.currentTimeMillis() - startedAt) / 1000).coerceAtLeast(1)
                        viewModel.submitQuiz(studentId, moduleId, answers, durationSeconds)
                        onFinished()
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = isComplete
            ) {
                Text("Submit Quiz")
            }
        }
    }
}

@Composable
private fun QuestionCard(question: QuizQuestionEntity, answer: String, onAnswer: (String) -> Unit) {
    val type = QuestionType.valueOf(question.type)
    val choices = remember(question.choicesJson) {
        if (question.choicesJson.isBlank()) emptyList() else Json.decodeFromString<List<String>>(question.choicesJson)
    }
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(question.questionText, fontWeight = FontWeight.Bold)
            Text(type.name.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() }, color = Color(0xFF64748B))
            if (choices.isNotEmpty()) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    choices.forEach { choice ->
                        FilterChip(
                            selected = answer == choice,
                            onClick = { onAnswer(choice) },
                            label = { Text(choice) }
                        )
                    }
                }
            } else {
                OutlinedTextField(
                    value = answer,
                    onValueChange = onAnswer,
                    label = { Text("Your answer") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
fun QuizResultScreen(viewModel: LearningHubViewModel, onDashboard: () -> Unit) {
    val result by viewModel.lastQuizResult.collectAsStateWithLifecycle()
    HubScaffold(title = "Quiz Result") { modifier ->
        val data = result
        Column(
            modifier
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
                .fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (data == null) {
                Text("No quiz result yet.")
            } else {
                Text("${data.score}/${data.totalItems}", style = MaterialTheme.typography.displayMedium, fontWeight = FontWeight.Bold)
                Text(data.masteryLevel.label, style = MaterialTheme.typography.titleLarge)
                Text("Try ${data.attemptNumber} - ${formatDuration(data.durationSeconds)}")
                Text("Weak topic: ${data.weakTopic}")
                Text("Strong topic: ${data.strongTopic}")
                QrCodeImage(payload = data.resultJson)
            }
            Button(onClick = onDashboard, modifier = Modifier.fillMaxWidth()) { Text("Back to Dashboard") }
        }
    }
}

@Composable
fun TeacherDashboardScreen(
    viewModel: LearningHubViewModel,
    onBack: () -> Unit,
    onRecordBook: () -> Unit,
    onScanner: () -> Unit,
    onGurobot: () -> Unit,
    onStudentView: () -> Unit,
    onStudentSelected: (String) -> Unit
) {
    val dashboard by viewModel.teacherDashboard.collectAsStateWithLifecycle()
    val teacherName by viewModel.currentTeacherName.collectAsStateWithLifecycle()
    HubScaffold(
        title = "Teacher Dashboard",
        onBack = onBack,
        actions = {
            OutlinedButton(onClick = onScanner, modifier = Modifier.padding(end = 8.dp)) {
                Text("Scan")
            }
        },
        bottomBar = {
            TeacherBottomMenu("dashboard", onRecordBook, onScanner, onGurobot, onStudentView)
        }
    ) { modifier ->
        Column(
            modifier
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "Hello Sir / Ma'am $teacherName",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.ExtraBold,
                color = Indigo900
            )
            MetricCard("Class Average", "${dashboard.classAverage}%")
            SectionTitle("Leaderboard")
            dashboard.topStudents.forEach { StudentRankRow(it, onClick = { onStudentSelected(it.studentId) }) }
            SectionTitle("Needs Intervention")
            dashboard.interventionStudents.forEach { StudentRankRow(it, onClick = { onStudentSelected(it.studentId) }) }
        }
    }
}

@Composable
private fun TeacherBottomMenu(
    selected: String,
    onRecordBook: () -> Unit,
    onScanner: () -> Unit,
    onGurobot: () -> Unit,
    onStudentView: () -> Unit
) {
    NavigationBar(containerColor = SurfaceLowest) {
        NavigationBarItem(
            selected = selected == "record",
            onClick = onRecordBook,
            icon = { Text("📓", fontSize = 18.sp) },
            label = { Text("Record Book", style = MaterialTheme.typography.labelSmall) }
        )
        NavigationBarItem(
            selected = selected == "scanner",
            onClick = onScanner,
            icon = { Text("⬛", fontSize = 18.sp) },
            label = { Text("Scanner", style = MaterialTheme.typography.labelSmall) }
        )
        NavigationBarItem(
            selected = selected == "gurobot",
            onClick = onGurobot,
            icon = { Text("🤖", fontSize = 18.sp) },
            label = { Text("GuroBot", style = MaterialTheme.typography.labelSmall) }
        )
        NavigationBarItem(
            selected = selected == "studentView",
            onClick = onStudentView,
            icon = { Text("👁", fontSize = 18.sp) },
            label = { Text("Student View", style = MaterialTheme.typography.labelSmall) }
        )
    }
}

@Composable
private fun StudentRankRow(row: RecordBookRow, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    recordName(row),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = Indigo900
                )
                Text("${row.completedModules}/${row.totalModules} modules - ${row.totalAttempts} tries", color = Color(0xFF64748B))
                Text(row.weakTopic, color = Color(0xFF64748B))
            }
            Text("${row.averageScore}%", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun RecordBookScreen(
    viewModel: LearningHubViewModel,
    onBack: () -> Unit,
    onRecordBook: () -> Unit,
    onScanner: () -> Unit,
    onGurobot: () -> Unit,
    onStudentView: () -> Unit,
    onStudentSelected: (String) -> Unit
) {
    val rows by viewModel.recordBook.collectAsStateWithLifecycle()
    val sections = remember(rows) { listOf("All Sections") + rows.map { it.section }.distinct().sorted() }
    var selectedSection by remember { mutableStateOf("All Sections") }
    val visibleRows = remember(rows, selectedSection) {
        if (selectedSection == "All Sections") rows else rows.filter { it.section == selectedSection }
    }
    HubScaffold(
        title = "Record Book",
        onBack = onBack,
        bottomBar = { TeacherBottomMenu("record", onRecordBook, onScanner, onGurobot, onStudentView) }
    ) { modifier ->
        LazyColumn(modifier = modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                SectionDropdown(sections = sections, selected = selectedSection, onSelected = { selectedSection = it })
            }
            items(visibleRows, key = { it.studentId }) { row ->
                Card(onClick = { onStudentSelected(row.studentId) }, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                recordName(row),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.ExtraBold,
                                color = Indigo900,
                                modifier = Modifier.weight(1f)
                            )
                            Text("${row.averageScore}%")
                        }
                        Text("Grade ${row.gradeLevel} - ${row.section}")
                        Text("Completed: ${row.completedModules}/${row.totalModules} (${row.gradeCompletionPercent}%)")
                        Text("Attempts: ${row.totalAttempts} - Last time: ${formatDuration(row.lastQuizDurationSeconds)}")
                        Text("Weak topic: ${row.weakTopic}")
                    }
                }
            }
        }
    }
}

@Composable
fun StudentPerformanceScreen(
    viewModel: LearningHubViewModel,
    studentId: String,
    onBack: () -> Unit
) {
    val row by remember(studentId) { viewModel.studentRecord(studentId) }.collectAsState(initial = null)
    val attempts by remember(studentId) { viewModel.attemptsForStudent(studentId) }.collectAsState(initial = emptyList())
    val assessment by viewModel.studentAssessment.collectAsStateWithLifecycle()
    HubScaffold(title = "Student Performance", onBack = onBack) { modifier ->
        val data = row
        if (data == null) {
            Box(modifier, contentAlignment = Alignment.Center) { Text("Loading performance...") }
        } else {
            Column(
                modifier
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    recordName(data),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = Indigo900
                )
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    MetricCard("Average", "${data.averageScore}%", Modifier.weight(1f))
                    MetricCard("Completion", "${data.gradeCompletionPercent}%", Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    MetricCard("Attempts", "${data.totalAttempts}", Modifier.weight(1f))
                    MetricCard("Last Time", formatDuration(data.lastQuizDurationSeconds), Modifier.weight(1f))
                }
                HubAnalysisCard(text = performanceAnalysis(data))
                HubPrimaryButton(
                    text = "Generate GuroBot Teaching Actions",
                    onClick = { viewModel.assessStudentPerformance(data) },
                    modifier = Modifier.fillMaxWidth()
                )
                if (assessment.isNotBlank()) {
                    HubAssessmentCard(text = assessment)
                }
                SectionTitle("Scanned QR Results")
                attempts.forEach { AttemptRow(it) }
            }
        }
    }
}

@Composable
private fun AttemptRow(attempt: QuizAttemptEntity) {
    HubAttemptRow(
        attemptNumber = attempt.attemptNumber,
        score = attempt.score,
        totalItems = attempt.totalItems,
        moduleId = attempt.moduleId,
        formattedDuration = formatDuration(attempt.durationSeconds),
        masteryLevel = attempt.masteryLevel,
        weakTopic = attempt.weakTopic
    )
}

@Composable
fun LessonPlanLibraryScreen(viewModel: LearningHubViewModel, onBack: () -> Unit, onGurobot: () -> Unit) {
    val plans by viewModel.lessonPlans.collectAsStateWithLifecycle()
    val context = LocalContext.current
    HubScaffold(title = "Lesson Plan Library", onBack = onBack) { modifier ->
        Column(modifier.padding(16.dp)) {
            Button(onClick = onGurobot, modifier = Modifier.fillMaxWidth()) { Text("Generate With Gurobot") }
            Spacer(Modifier.height(12.dp))
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(plans, key = { it.id }) { plan ->
                    val input = GurobotInput(
                        gradeLevel = plan.gradeLevel,
                        subject = plan.subject,
                        competencyCode = plan.competencyCode,
                        topic = plan.topic,
                        action = "Saved lesson plan",
                        quarter = moduleQuarter(plan.competencyCode),
                        moduleNumber = moduleNumber(plan.competencyCode)
                    )
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(plan.title, fontWeight = FontWeight.Bold)
                            Text("${plan.subject} - Grade ${plan.gradeLevel} - Lesson Name: ${plan.competencyCode.ifBlank { plan.topic }}")
                            HorizontalDivider()
                            FormattedText(plan.generatedContent)
                            OutlinedButton(
                                onClick = { shareGurobotLessonText(context, input, plan.generatedContent) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Share TXT via Bluetooth")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun GurobotScreen(
    viewModel: LearningHubViewModel,
    onBack: () -> Unit,
    onRecordBook: (() -> Unit)? = null,
    onScanner: (() -> Unit)? = null,
    onGurobot: (() -> Unit)? = null,
    onStudentView: (() -> Unit)? = null
) {
    var subject by remember { mutableStateOf(SubjectType.SCIENCE.name) }
    var gradeText by remember { mutableStateOf("5") }
    var quarterText by remember { mutableStateOf("1") }
    var moduleText by remember { mutableStateOf("1") }
    var action by remember { mutableStateOf("Generate lesson plan") }
    val response by viewModel.gurobotResponse.collectAsStateWithLifecycle()
    val gradeLevel = (gradeText.toIntOrNull() ?: 5).coerceIn(1, 10)
    val quarter = quarterText.toIntOrNull()?.coerceIn(1, 4) ?: 1
    val maxModule = viewModel.maxModuleFor(subject, gradeLevel, quarter)
    val moduleNumber = (moduleText.toIntOrNull() ?: 1).coerceIn(1, maxModule)
    val topic = viewModel.curriculumTopic(subject, gradeLevel, quarter, moduleNumber)
    val lessonName = viewModel.lessonName(subject, gradeLevel, quarter, moduleNumber)
    val input = GurobotInput(gradeLevel, subject, lessonName, topic, action, quarter, moduleNumber)
    val context = LocalContext.current
    val bottomMenu: @Composable () -> Unit = if (onRecordBook != null && onScanner != null && onGurobot != null && onStudentView != null) {
        { TeacherBottomMenu("gurobot", onRecordBook, onScanner, onGurobot, onStudentView) }
    } else {
        {}
    }
    HubScaffold(title = "Gurobot", onBack = onBack, bottomBar = bottomMenu) { modifier ->
        Column(
            modifier
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SubjectDropdown(selected = subject, onSelected = { subject = it })
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(gradeText, { gradeText = it.filter(Char::isDigit).take(2) }, label = { Text("Grade") }, modifier = Modifier.weight(1f))
                OutlinedTextField(quarterText, { quarterText = it.filter(Char::isDigit).take(1) }, label = { Text("Quarter") }, modifier = Modifier.weight(1f))
                OutlinedTextField(moduleText, { moduleText = it.filter(Char::isDigit).take(2) }, label = { Text("Module") }, modifier = Modifier.weight(1f))
            }
            Text("Caps: Grade 10, Quarter 4, Module $maxModule for this curriculum filter.", color = Color(0xFF64748B))
            OutlinedTextField(lessonName, {}, label = { Text("Lesson Name") }, readOnly = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(topic, {}, label = { Text("Matched Curriculum Topic") }, readOnly = true, modifier = Modifier.fillMaxWidth())
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Generate lesson plan", "Make it easier", "Add group activity", "Add formative quiz", "Add low-resource version", "Add intervention activity").forEach { option ->
                    FilterChip(selected = action == option, onClick = { action = option }, label = { Text(option) })
                }
            }
            Button(onClick = { viewModel.generateLesson(input) }, modifier = Modifier.fillMaxWidth()) {
                Text("Generate Draft")
            }
            response?.let {
                val canShare = it.sourceLabel != "Working" && it.content.isNotBlank()
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDFA))) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(it.sourceLabel, fontWeight = FontWeight.Bold)
                        FormattedText(it.content)
                        OutlinedButton(
                            onClick = { shareGurobotLessonText(context, input, it.content) },
                            enabled = canShare,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Share TXT via Bluetooth")
                        }
                        OutlinedButton(
                            onClick = { viewModel.saveGeneratedLesson(input, it.content) },
                            enabled = canShare,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Save To Lesson Library")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SubjectDropdown(selected: String, onSelected: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
            Text(SubjectType.fromName(selected).label)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            CoreSubjectTypes.forEach { subject ->
                DropdownMenuItem(
                    text = { Text(subject.label) },
                    onClick = {
                        expanded = false
                        onSelected(subject.name)
                    }
                )
            }
        }
    }
}

@Composable
fun TeacherStudentViewScreen(
    viewModel: LearningHubViewModel,
    onBack: () -> Unit,
    onOpenModule: (String) -> Unit,
    onRecordBook: () -> Unit,
    onScanner: () -> Unit,
    onGurobot: () -> Unit,
    onStudentView: () -> Unit
) {
    val modules by remember { viewModel.modulesForGrade(5) }.collectAsState(initial = emptyList())
    var selected by remember { mutableStateOf(SubjectType.SCIENCE) }
    HubScaffold(
        title = "Student View",
        onBack = onBack,
        bottomBar = { TeacherBottomMenu("studentView", onRecordBook, onScanner, onGurobot, onStudentView) }
    ) { modifier ->
        Column(modifier.padding(16.dp)) {
            ScrollableTabRow(selectedTabIndex = ModuleSubjectTypes.indexOf(selected), edgePadding = 0.dp) {
                ModuleSubjectTypes.forEach { subject ->
                    Tab(
                        selected = selected == subject,
                        onClick = { selected = subject },
                        text = { Text(subject.label) }
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(
                    modules.filter { it.subject == selected.name }
                        .sortedWith(compareBy<ModuleEntity> { moduleNumber(it) }.thenBy { it.isTeacherCreated }.thenBy { it.title }),
                    key = { it.id }
                ) { module ->
                    TeacherPreviewModuleCard(module = module, onOpen = { onOpenModule(module.id) })
                }
            }
        }
    }
}

@Composable
private fun TeacherPreviewModuleCard(module: ModuleEntity, onOpen: () -> Unit) {
    val number = moduleNumber(module)
    val title = when {
        module.subject == SubjectType.ADDED_MATERIALS.name -> "Added Material: ${module.title}"
        module.isTeacherCreated -> "Additional Module $number: ${module.title}"
        else -> "Module $number: ${module.title}"
    }
    Card(onClick = onOpen, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, fontWeight = FontWeight.Bold)
            Text("Lesson Name: ${module.competencyCode.ifBlank { module.title }}", color = Color(0xFF475569))
            Text(module.content.take(180) + if (module.content.length > 180) "..." else "")
        }
    }
}

@Composable
fun TeacherScannerScreen(
    viewModel: LearningHubViewModel,
    onBack: () -> Unit,
    onRecordBook: () -> Unit,
    onScanner: () -> Unit,
    onGurobot: () -> Unit,
    onStudentView: () -> Unit
) {
    val message by viewModel.syncMessage.collectAsStateWithLifecycle()
    HubScaffold(
        title = "Scanner",
        onBack = onBack,
        bottomBar = { TeacherBottomMenu("scanner", onRecordBook, onScanner, onGurobot, onStudentView) }
    ) { modifier ->
        QrImportContent(
            modifier = modifier,
            message = message,
            label = "Student enrollment, quiz result, or progress QR",
            formatter = viewModel::formatQrPayload,
            onImport = viewModel::importTeacherScan
        )
    }
}

@Composable
fun StudentModuleScannerScreen(
    viewModel: LearningHubViewModel,
    onBack: () -> Unit
) {
    val message by viewModel.syncMessage.collectAsStateWithLifecycle()
    HubScaffold(title = "Teacher Module Scanner", onBack = onBack) { modifier ->
        QrImportContent(
            modifier = modifier,
            message = message,
            label = "Teacher module QR",
            formatter = viewModel::formatQrPayload,
            onImport = viewModel::importStudentScan
        )
    }
}

@Composable
fun StudentQrCodeScreen(
    viewModel: LearningHubViewModel,
    studentId: String,
    onBack: () -> Unit,
    onModules: () -> Unit,
    onQrCode: () -> Unit,
    onProfile: () -> Unit
) {
    val student by remember(studentId) { viewModel.observeStudent(studentId) }.collectAsState(initial = null)
    var payload by remember { mutableStateOf("") }
    HubScaffold(
        title = "QR Code",
        onBack = onBack,
        bottomBar = { StudentBottomMenu("qr", onModules, onQrCode, onProfile) }
    ) { modifier ->
        Column(
            modifier
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "Student Information QR",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold,
                color = Indigo900
            )
            Text(
                "Generate your student profile QR for enrollment and teacher records.",
                style = MaterialTheme.typography.bodyMedium,
                color = OnSurfaceVariant
            )
            Button(
                onClick = {
                    val data = student ?: return@Button
                    payload = viewModel.studentProfileJson(
                        studentId = data.id,
                        studentNumber = data.studentNumber,
                        firstName = data.firstName,
                        lastName = data.lastName,
                        middleInitial = data.middleInitial,
                        gradeLevel = data.gradeLevel,
                        section = data.section,
                        birthday = data.birthday
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = student != null
            ) {
                Text("Generate Student Info QR")
            }
            if (payload.isNotBlank()) {
                QrCodeImage(payload = payload, modifier = Modifier.align(Alignment.CenterHorizontally))
            }
        }
    }
}

@Composable
fun StudentProfileScreen(
    viewModel: LearningHubViewModel,
    studentId: String,
    onBack: () -> Unit,
    onModules: () -> Unit,
    onQrCode: () -> Unit,
    onProfile: () -> Unit
) {
    val context = LocalContext.current
    val student by remember(studentId) { viewModel.observeStudent(studentId) }.collectAsState(initial = null)
    var payload by remember { mutableStateOf("") }
    val uploadLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) viewModel.updateProfileImage(studentId, uri.toString())
    }
    HubScaffold(
        title = "Profile",
        onBack = onBack,
        bottomBar = { StudentBottomMenu("profile", onModules, onQrCode, onProfile) }
    ) { modifier ->
        val data = student
        if (data == null) {
            Box(modifier, contentAlignment = Alignment.Center) { Text("Loading profile...") }
        } else {
            Column(
                modifier
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                val bitmap = remember(data.profileImageUri) {
                    data.profileImageUri.takeIf { it.isNotBlank() }?.let { bitmapFromUri(context, Uri.parse(it)) }
                }
                if (bitmap != null) {
                    Image(
                        bitmap = bitmap.asImageBitmap(),
                        contentDescription = "Profile picture",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.size(140.dp)
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .size(140.dp)
                            .background(Color(0xFFE5E7EB), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(data.firstName.take(1), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    }
                }
                OutlinedButton(onClick = { uploadLauncher.launch("image/*") }, modifier = Modifier.fillMaxWidth()) {
                    Text("Upload Profile Picture")
                }
                ProfileLine("Student Number", data.studentNumber)
                ProfileLine("Full Name", recordName(data.lastName, data.firstName, data.middleInitial))
                ProfileLine("Birthday", data.birthday.ifBlank { "Not set" })
                ProfileLine("Grade & Section", "Grade ${data.gradeLevel} - ${data.section}")
                Button(
                    onClick = {
                        payload = viewModel.studentProfileJson(
                            studentId = data.id,
                            studentNumber = data.studentNumber,
                            firstName = data.firstName,
                            lastName = data.lastName,
                            middleInitial = data.middleInitial,
                            gradeLevel = data.gradeLevel,
                            section = data.section,
                            birthday = data.birthday
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Generate Info QR")
                }
                if (payload.isNotBlank()) {
                    QrCodeImage(payload = payload)
                }
            }
        }
    }
}

@Composable
private fun ProfileLine(label: String, value: String) {
    ProfileInfoRow(label = label, value = value)
}

@Composable
private fun QrImportContent(
    modifier: Modifier,
    message: String,
    label: String,
    formatter: (String) -> String,
    onImport: (String) -> Unit
) {
    val context = LocalContext.current
    var scanKey by remember { mutableStateOf(0) }
    var formattedText by remember { mutableStateOf("") }
    var photoMessage by remember { mutableStateOf("") }
    val uploadLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            decodeQrFromUri(
                context = context,
                uri = uri,
                onDecoded = { decoded ->
                    formattedText = formatter(decoded)
                    photoMessage = ""
                    onImport(decoded)
                },
                onError = { photoMessage = "No Pavo QR code was found in that photo." }
            )
        }
    }
    Column(
        modifier
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        QrCameraBox(scanKey = scanKey) { scanned ->
            formattedText = formatter(scanned)
            onImport(scanned)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Button(onClick = { scanKey++ }, modifier = Modifier.weight(1f)) {
                Text("Scan QR Code")
            }
            OutlinedButton(onClick = { uploadLauncher.launch("image/*") }, modifier = Modifier.weight(1f)) {
                Text("Upload QR Photo")
            }
        }
        if (formattedText.isNotBlank()) {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDFA))) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(label, fontWeight = FontWeight.Bold)
                    FormattedText(formattedText)
                }
            }
        }
        if (photoMessage.isNotBlank()) {
            Text(photoMessage, color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
        }
        if (message.isNotBlank()) {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFBEB))) {
                Text(message, modifier = Modifier.padding(16.dp), fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun QrCameraBox(scanKey: Int, onScan: (String) -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var hasPermission by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    var handled by remember(scanKey) { mutableStateOf(false) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasPermission = granted
    }
    LaunchedEffect(Unit) {
        if (!hasPermission) launcher.launch(Manifest.permission.CAMERA)
    }

    if (!hasPermission) {
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC))) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Camera permission is needed for QR scanning.", fontWeight = FontWeight.Bold)
                OutlinedButton(onClick = { launcher.launch(Manifest.permission.CAMERA) }) {
                    Text("Allow Camera")
                }
            }
        }
        return
    }

    val previewView = remember {
        PreviewView(context).apply {
            scaleType = PreviewView.ScaleType.FILL_CENTER
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        }
    }
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    DisposableEffect(Unit) {
        onDispose {
            cameraExecutor.shutdown()
            runCatching { ProcessCameraProvider.getInstance(context).get().unbindAll() }
        }
    }
    LaunchedEffect(previewView, lifecycleOwner) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener(
            {
                val cameraProvider = cameraProviderFuture.get()
                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }
                val scanner = BarcodeScanning.getClient(
                    BarcodeScannerOptions.Builder()
                        .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                        .build()
                )
                val analysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                    val mediaImage = imageProxy.image
                    if (mediaImage == null) {
                        imageProxy.close()
                        return@setAnalyzer
                    }
                    val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                    scanner.process(inputImage)
                        .addOnSuccessListener { barcodes ->
                            val value = barcodes.firstOrNull()?.rawValue
                            if (!value.isNullOrBlank() && !handled) {
                                ContextCompat.getMainExecutor(context).execute {
                                    handled = true
                                    onScan(value)
                                }
                            }
                        }
                        .addOnCompleteListener {
                            imageProxy.close()
                        }
                }
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
            },
            ContextCompat.getMainExecutor(context)
        )
    }
    AndroidView(
        factory = { previewView },
        modifier = Modifier
            .fillMaxWidth()
            .height(260.dp)
    )
}

private fun decodeQrFromUri(
    context: android.content.Context,
    uri: Uri,
    onDecoded: (String) -> Unit,
    onError: () -> Unit
) {
    runCatching {
        val image = InputImage.fromFilePath(context, uri)
        val scanner = BarcodeScanning.getClient(
            BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .build()
        )
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                val value = barcodes.firstOrNull()?.rawValue
                if (value.isNullOrBlank()) {
                    decodeQrWithZxing(context, uri)?.let(onDecoded) ?: onError()
                } else {
                    onDecoded(value)
                }
            }
            .addOnFailureListener {
                decodeQrWithZxing(context, uri)?.let(onDecoded) ?: onError()
            }
    }.onFailure { onError() }
}

private fun decodeQrWithZxing(context: android.content.Context, uri: Uri): String? {
    val bitmap = bitmapFromUri(context, uri) ?: return null
    return runCatching {
        val sourceBitmap = if (bitmap.config == Bitmap.Config.ARGB_8888) bitmap else bitmap.copy(Bitmap.Config.ARGB_8888, false)
        val pixels = IntArray(sourceBitmap.width * sourceBitmap.height)
        sourceBitmap.getPixels(pixels, 0, sourceBitmap.width, 0, 0, sourceBitmap.width, sourceBitmap.height)
        val source = RGBLuminanceSource(sourceBitmap.width, sourceBitmap.height, pixels)
        QRCodeReader().decode(BinaryBitmap(HybridBinarizer(source))).text
    }.getOrNull()
}

@Composable
fun SyncScreen(
    viewModel: LearningHubViewModel,
    mode: String,
    studentId: String,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val message by viewModel.syncMessage.collectAsStateWithLifecycle()
    var qrPayload by remember { mutableStateOf("") }
    HubScaffold(title = "QR Sync", onBack = onBack) { modifier ->
        Column(
            modifier
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (mode == "student") {
                Text("Generate this student's local progress QR.")
                Button(
                    onClick = {
                        scope.launch { qrPayload = viewModel.exportProgress(studentId) }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Generate Progress QR") }
                if (qrPayload.isNotBlank()) {
                    QrCodeImage(payload = qrPayload, modifier = Modifier.align(Alignment.CenterHorizontally))
                    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDFA))) {
                        FormattedText(viewModel.formatQrPayload(qrPayload), modifier = Modifier.padding(16.dp))
                    }
                }
            } else {
                Text("Use the Scanner tab to scan or upload a student progress QR.")
            }
            if (message.isNotBlank()) {
                Text(message, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun QrCodeImage(payload: String, modifier: Modifier = Modifier) {
    val bitmap = remember(payload) { qrBitmap(payload) }
    if (bitmap == null) {
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFBEB)), modifier = modifier.fillMaxWidth()) {
            Text("QR payload is too large to render on this device.", modifier = Modifier.padding(16.dp))
        }
    } else {
        Image(
            bitmap = bitmap.asImageBitmap(),
            contentDescription = "QR code",
            modifier = modifier.size(220.dp)
        )
    }
}

private fun qrBitmap(payload: String): Bitmap? {
    if (payload.isBlank()) return null
    return runCatching {
        val size = 720
        val matrix = QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, size, size)
        Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
            for (x in 0 until size) {
                for (y in 0 until size) {
                    setPixel(x, y, if (matrix[x, y]) AndroidColor.BLACK else AndroidColor.WHITE)
                }
            }
        }
    }.getOrNull()
}

private fun moduleNumber(module: ModuleEntity): Int =
    moduleNumber(module.competencyCode).takeIf { it > 0 }
        ?: Regex("m(\\d+)", RegexOption.IGNORE_CASE).find(module.id)?.groupValues?.getOrNull(1)?.toIntOrNull()
        ?: 1

private fun moduleNumber(code: String): Int =
    Regex("-M(\\d+)", RegexOption.IGNORE_CASE).find(code)?.groupValues?.getOrNull(1)?.toIntOrNull() ?: 1

private fun moduleQuarter(code: String): Int =
    Regex("-Q(\\d+)", RegexOption.IGNORE_CASE).find(code)?.groupValues?.getOrNull(1)?.toIntOrNull() ?: 1

private fun averagePercent(attempts: List<QuizAttemptEntity>): Double {
    val valid = attempts.filter { it.totalItems > 0 }
    if (valid.isEmpty()) return 0.0
    return valid.map { it.score.toDouble() / it.totalItems * 100.0 }.average().let { (it * 10).toInt() / 10.0 }
}

private fun completionPercent(completed: Int, total: Int): Int {
    if (total <= 0) return 0
    return ((completed.coerceIn(0, total).toDouble() / total) * 100).toInt()
}

private fun recordName(row: RecordBookRow): String =
    recordName(row.lastName, row.firstName, row.middleInitial)

private fun recordName(lastName: String, firstName: String, middleInitial: String): String {
    val middle = middleInitial.trim().take(1).let { if (it.isBlank()) "" else ", $it." }
    return "${lastName.trim()}, ${firstName.trim()}$middle".trim(',', ' ')
}

@Composable
private fun SectionDropdown(sections: List<String>, selected: String, onSelected: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
            Text(selected)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            sections.forEach { section ->
                DropdownMenuItem(
                    text = { Text(section) },
                    onClick = {
                        expanded = false
                        onSelected(section)
                    }
                )
            }
        }
    }
}

private fun lessonPages(module: ModuleEntity): List<String> {
    if (module.subject == SubjectType.ADDED_MATERIALS.name) {
        return listOf(module.content)
    }
    val intro = "Overview\n\n${module.content}\n\nLesson Name: ${module.competencyCode.ifBlank { module.title }}"
    val activity = "Learning Activities\n\n1. Read the key idea.\n2. Study the example.\n3. Answer the guide question in your notebook.\n4. Explain your answer using details from the lesson."
    val check = "Check Your Understanding\n\nWrite three things you learned about ${module.title}. Then prepare for the module quiz when you return to the module overview."
    return listOf(intro, activity, check)
}

private fun bitmapFromUri(context: android.content.Context, uri: Uri): Bitmap? =
    runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val source = ImageDecoder.createSource(context.contentResolver, uri)
            ImageDecoder.decodeBitmap(source)
        } else {
            @Suppress("DEPRECATION")
            MediaStore.Images.Media.getBitmap(context.contentResolver, uri)
        }
    }.getOrNull()

private fun formatDuration(seconds: Long): String {
    if (seconds <= 0) return "0s"
    val minutes = seconds / 60
    val secs = seconds % 60
    return if (minutes > 0) "${minutes}m ${secs}s" else "${secs}s"
}

private fun performanceAnalysis(row: RecordBookRow): String {
    val pace = when {
        row.averageScore >= 90.0 -> "advanced performance"
        row.averageScore >= 80.0 -> "proficient performance"
        row.averageScore >= 70.0 -> "developing performance"
        else -> "beginning performance"
    }
    val focus = if (row.weakTopic == "No weak topic yet") {
        "No recurring weak topic has been scanned yet."
    } else {
        "The clearest support area is ${row.weakTopic}."
    }
    return "${row.name} shows $pace across ${row.totalAttempts} scanned result(s). $focus Completion is ${row.completedModules}/${row.totalModules} modules, so the next review should compare score trend with completion pace."
}
