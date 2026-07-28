package com.pangarap.learninghub.curriculum

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.io.InputStream
import java.security.MessageDigest
import kotlin.math.sqrt

/*
 * Integration Notes
 * -----------------
 * CurriculumStore is the single RAG boundary for curriculum ingestion,
 * chunking, embedding, and retrieval. Downstream services depend only on
 * retrieve(query, topK), so switching subjects requires creating a new
 * CurriculumStore with a different curriculum source.
 *
 * Supported sources:
 * - File path through CurriculumStore(curriculumPath = "...")
 * - Upload stream through CurriculumSource.UploadStream
 * - Object storage URI through CurriculumSource.ObjectStorageUri plus a stream opener
 *
 * Required configuration:
 * - GEMINI_API_KEY for Gemini Embedding API calls.
 * - Supported text formats with no extra dependencies: .txt, .md, .csv, .json.
 * - Direct PDF text extraction requires an Android PDF parser dependency such as
 *   com.tom-roush:pdfbox-android; the current project has no PDF parser.
 */
class CurriculumStore(
    private val curriculumSource: CurriculumSource,
    private val config: CurriculumStoreConfig = CurriculumStoreConfig(),
    private val geminiClient: GeminiRestClient = GeminiRestClient(),
    private val changelogManager: ChangelogManager = ChangelogManager()
) {
    constructor(
        curriculumPath: String,
        config: CurriculumStoreConfig = CurriculumStoreConfig(),
        geminiClient: GeminiRestClient = GeminiRestClient(),
        changelogManager: ChangelogManager = ChangelogManager()
    ) : this(
        curriculumSource = CurriculumSource.FilePath(File(curriculumPath)),
        config = config,
        geminiClient = geminiClient,
        changelogManager = changelogManager
    )

    private val indexedChunks = mutableListOf<EmbeddedCurriculumChunk>()
    private var indexed = false

    suspend fun index(): CurriculumIndexingResult {
        return runCatching {
            val document = readDocument()
            val chunks = chunkDocument(document)
            indexedChunks.clear()
            chunks.forEach { chunk ->
                val embedding = geminiClient.embedText(
                    text = chunk.text,
                    model = config.embeddingModel,
                    maxRetries = config.maxRetries
                )
                indexedChunks.add(EmbeddedCurriculumChunk(chunk, embedding))
            }
            indexed = true
            CurriculumIndexingResult(
                sourceFileName = document.sourceFileName,
                chunkCount = chunks.size,
                embeddingCount = indexedChunks.size,
                vectorStoreTarget = "Local in-memory cosine index"
            ).also { result ->
                changelogManager.append(
                    eventType = ChangelogEventType.CURRICULUM_INDEXED,
                    componentName = "CurriculumStore",
                    description = "Indexed curriculum source for retrieval.",
                    details = listOf(
                        "Source file: ${result.sourceFileName}",
                        "Chunk count: ${result.chunkCount}",
                        "Embedding count: ${result.embeddingCount}",
                        "Vector store target: ${result.vectorStoreTarget}"
                    )
                )
            }
        }.getOrElse { failure ->
            changelogManager.logError(
                componentName = "CurriculumStore",
                errorCodeOrType = failure::class.simpleName.orEmpty(),
                description = failure.message.orEmpty().ifBlank { "Curriculum indexing failed" }
            )
            throw failure
        }
    }

    suspend fun retrieve(query: String, topK: Int = 5): List<CurriculumChunk> {
        require(topK > 0) { "topK must be greater than zero" }
        if (!indexed) index()
        if (indexedChunks.isEmpty() || query.isBlank()) return emptyList()
        val queryEmbedding = geminiClient.embedText(
            text = query,
            model = config.embeddingModel,
            maxRetries = config.maxRetries
        )
        return indexedChunks
            .map { embedded ->
                embedded.chunk.copy(similarityScore = cosineSimilarity(queryEmbedding, embedded.embedding))
            }
            .sortedByDescending { it.similarityScore ?: 0.0 }
            .take(topK)
    }

    fun indexedChunkCount(): Int = indexedChunks.size

    private suspend fun readDocument(): CurriculumDocument = withContext(Dispatchers.IO) {
        val sourceName = curriculumSource.displayName
        val extension = sourceName.substringAfterLast('.', missingDelimiterValue = "").lowercase()
        val rawText = when (curriculumSource) {
            is CurriculumSource.FilePath -> {
                val file = curriculumSource.file
                if (!file.exists()) throw CurriculumIngestionException("Curriculum file not found: ${file.path}")
                readTextByExtension(file.name, extension) { file.inputStream() }
            }
            is CurriculumSource.UploadStream -> {
                readTextByExtension(sourceName, extension) { curriculumSource.openStream() }
            }
            is CurriculumSource.ObjectStorageUri -> {
                readTextByExtension(sourceName, extension) { curriculumSource.openStream(curriculumSource.uri) }
            }
        }
        CurriculumDocument(
            sourceFileName = sourceName,
            text = cleanText(rawText),
            defaultSubject = config.defaultSubjectDomain,
            defaultGradeLevel = config.defaultGradeLevel
        )
    }

    private suspend fun readTextByExtension(
        sourceName: String,
        extension: String,
        openStream: suspend () -> InputStream
    ): String {
        if (extension == "pdf") {
            throw CurriculumIngestionException(
                "PDF ingestion requested for $sourceName, but no Android PDF text parser dependency is configured"
            )
        }
        val raw = openStream().use { input ->
            input.bufferedReader(Charsets.UTF_8).use { it.readText() }
        }
        return if (extension == "json") extractJsonText(raw) else raw
    }

    private fun extractJsonText(raw: String): String {
        return runCatching {
            fun walk(element: kotlinx.serialization.json.JsonElement): List<String> {
                return when (element) {
                    is JsonObject -> element.entries.flatMap { (key, value) ->
                        val valueText = walk(value)
                        if (valueText.isEmpty()) emptyList() else listOf(key) + valueText
                    }
                    is JsonArray -> element.flatMap { walk(it) }
                    is JsonPrimitive -> listOfNotNull(
                        element.contentOrNull
                            ?: element.intOrNull?.toString()
                            ?: element.doubleOrNull?.toString()
                            ?: element.booleanOrNull?.toString()
                    )
                }
            }
            walk(Json.parseToJsonElement(raw)).joinToString("\n")
        }.getOrDefault(raw)
    }

    private fun cleanText(raw: String): String {
        return raw
            .replace("\uFEFF", "")
            .replace("\r\n", "\n")
            .replace("\r", "\n")
            .replace("\u000C", "\n\n[PAGE BREAK]\n\n")
            .replace(Regex("[\\t\\x0B]+"), " ")
            .lines()
            .map { it.trim().replace(Regex("\\s{2,}"), " ") }
            .joinToString("\n")
            .replace(Regex("\n{3,}"), "\n\n")
            .trim()
    }

    private fun chunkDocument(document: CurriculumDocument): List<CurriculumChunk> {
        if (document.text.isBlank()) return emptyList()
        val sections = splitIntoSections(document.text)
        val chunks = mutableListOf<CurriculumChunk>()
        sections.forEachIndexed { sectionIndex, section ->
            val tokens = tokenize(section.body)
            if (tokens.isEmpty()) return@forEachIndexed
            val windows = tokenWindows(tokens, config.chunkSizeTokens, config.chunkOverlapTokens)
            windows.forEachIndexed { windowIndex, tokenWindow ->
                val chunkText = tokenWindow.joinToString(" ")
                val metadata = extractMetadata(
                    sourceFileName = document.sourceFileName,
                    heading = section.heading,
                    text = chunkText,
                    defaultSubject = document.defaultSubject,
                    defaultGradeLevel = document.defaultGradeLevel
                )
                chunks.add(
                    CurriculumChunk(
                        id = stableChunkId(document.sourceFileName, sectionIndex, windowIndex, chunkText),
                        text = chunkText,
                        sourceFileName = document.sourceFileName,
                        subjectDomain = metadata.subjectDomain,
                        gradeLevel = metadata.gradeLevel,
                        unitTitle = metadata.unitTitle,
                        competencyCode = metadata.competencyCode,
                        pageReference = metadata.pageReference,
                        metadata = metadata.extra
                    )
                )
            }
        }
        return chunks
    }

    private fun splitIntoSections(text: String): List<CurriculumSection> {
        val sections = mutableListOf<CurriculumSection>()
        var currentHeading = "Curriculum Overview"
        val buffer = StringBuilder()
        text.lines().forEach { line ->
            val trimmed = line.trim()
            if (trimmed.isBlank()) return@forEach
            if (isSectionHeading(trimmed) && buffer.isNotBlank()) {
                sections.add(CurriculumSection(currentHeading, buffer.toString().trim()))
                currentHeading = trimmed
                buffer.clear()
            } else {
                if (isSectionHeading(trimmed) && buffer.isBlank()) {
                    currentHeading = trimmed
                }
                buffer.appendLine(trimmed)
            }
        }
        if (buffer.isNotBlank()) sections.add(CurriculumSection(currentHeading, buffer.toString().trim()))
        return sections.ifEmpty { listOf(CurriculumSection("Curriculum Overview", text)) }
    }

    private fun isSectionHeading(line: String): Boolean {
        if (line.length > 140) return false
        val normalized = line.trim()
        return normalized.matches(Regex("(?i)^(quarter|unit|lesson|module|content standard|performance standard|learning competency|competency|objective|strand)\\b.*")) ||
            (normalized.length in 4..80 && normalized == normalized.uppercase() && normalized.any { it.isLetter() })
    }

    private fun tokenize(text: String): List<String> =
        text.split(Regex("\\s+")).filter { it.isNotBlank() }

    private fun tokenWindows(tokens: List<String>, chunkSize: Int, overlap: Int): List<List<String>> {
        val safeChunkSize = chunkSize.coerceAtLeast(64)
        val safeOverlap = overlap.coerceIn(0, safeChunkSize / 2)
        if (tokens.size <= safeChunkSize) return listOf(tokens)
        val windows = mutableListOf<List<String>>()
        var start = 0
        while (start < tokens.size) {
            val end = (start + safeChunkSize).coerceAtMost(tokens.size)
            windows.add(tokens.subList(start, end))
            if (end == tokens.size) break
            start = (end - safeOverlap).coerceAtLeast(start + 1)
        }
        return windows
    }

    private fun extractMetadata(
        sourceFileName: String,
        heading: String,
        text: String,
        defaultSubject: String?,
        defaultGradeLevel: String?
    ): CurriculumMetadata {
        val sample = "$heading\n${text.take(1_200)}"
        val subject = defaultSubject ?: Regex("(?i)\\b(?:subject|learning area)\\s*[:\\-]\\s*([A-Za-z ]{2,40})")
            .find(sample)?.groupValues?.getOrNull(1)?.trim()
        val grade = defaultGradeLevel ?: Regex("(?i)\\b(?:grade level|grade)\\s*[:\\-]?\\s*([A-Za-z0-9 -]{1,24})")
            .find(sample)?.groupValues?.getOrNull(1)?.trim()
        val code = Regex("\\b[A-Z][A-Za-z0-9]{1,12}(?:[-./][A-Za-z0-9]+){1,6}\\b")
            .find(sample)?.value
        val page = Regex("(?i)\\bpage\\s*[:#]?\\s*([0-9ivxIVX]+(?:\\s*[-\\u2013]\\s*[0-9ivxIVX]+)?)")
            .find(sample)?.groupValues?.getOrNull(1)?.trim()
        val unit = heading.takeIf { it.isNotBlank() } ?: sourceFileName.substringBeforeLast('.')
        return CurriculumMetadata(
            subjectDomain = subject,
            gradeLevel = grade,
            unitTitle = unit,
            competencyCode = code,
            pageReference = page,
            extra = mapOf(
                "source_reference" to listOfNotNull(sourceFileName, unit, code, page?.let { "page $it" }).joinToString(" | ")
            )
        )
    }

    private fun stableChunkId(sourceFileName: String, sectionIndex: Int, windowIndex: Int, text: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("$sourceFileName:$sectionIndex:$windowIndex:$text".toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        return "cur_${digest.take(16)}"
    }

    private fun cosineSimilarity(left: List<Double>, right: List<Double>): Double {
        if (left.isEmpty() || right.isEmpty() || left.size != right.size) return 0.0
        var dot = 0.0
        var leftMagnitude = 0.0
        var rightMagnitude = 0.0
        left.indices.forEach { index ->
            dot += left[index] * right[index]
            leftMagnitude += left[index] * left[index]
            rightMagnitude += right[index] * right[index]
        }
        val denominator = sqrt(leftMagnitude) * sqrt(rightMagnitude)
        return if (denominator == 0.0) 0.0 else dot / denominator
    }
}

sealed class CurriculumSource(open val displayName: String) {
    data class FilePath(val file: File) : CurriculumSource(file.name)
    data class UploadStream(
        override val displayName: String,
        val openStream: suspend () -> InputStream
    ) : CurriculumSource(displayName)
    data class ObjectStorageUri(
        val uri: String,
        val openStream: suspend (String) -> InputStream
    ) : CurriculumSource(uri.substringAfterLast('/').ifBlank { uri })
}

data class CurriculumStoreConfig(
    val chunkSizeTokens: Int = 512,
    val chunkOverlapTokens: Int = 64,
    val embeddingModel: String = "text-embedding-004",
    val defaultSubjectDomain: String? = null,
    val defaultGradeLevel: String? = null,
    val maxRetries: Int = 3
)

@Serializable
data class CurriculumChunk(
    val id: String,
    val text: String,
    val sourceFileName: String,
    val subjectDomain: String? = null,
    val gradeLevel: String? = null,
    val unitTitle: String? = null,
    val competencyCode: String? = null,
    val pageReference: String? = null,
    val metadata: Map<String, String> = emptyMap(),
    val similarityScore: Double? = null
) {
    fun sourceReference(): String =
        listOfNotNull(
            sourceFileName,
            unitTitle?.let { "Unit: $it" },
            competencyCode?.let { "Code: $it" },
            pageReference?.let { "Page: $it" },
            "Chunk: $id"
        ).joinToString(" | ")
}

data class CurriculumIndexingResult(
    val sourceFileName: String,
    val chunkCount: Int,
    val embeddingCount: Int,
    val vectorStoreTarget: String
)

class CurriculumIngestionException(message: String) : Exception(message)

private data class CurriculumDocument(
    val sourceFileName: String,
    val text: String,
    val defaultSubject: String?,
    val defaultGradeLevel: String?
)

private data class CurriculumSection(
    val heading: String,
    val body: String
)

private data class CurriculumMetadata(
    val subjectDomain: String?,
    val gradeLevel: String?,
    val unitTitle: String?,
    val competencyCode: String?,
    val pageReference: String?,
    val extra: Map<String, String>
)

private data class EmbeddedCurriculumChunk(
    val chunk: CurriculumChunk,
    val embedding: List<Double>
)
