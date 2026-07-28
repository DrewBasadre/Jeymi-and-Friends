package com.pangarap.learninghub.curriculum

import com.pangarap.learninghub.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/*
 * Integration Notes
 * -----------------
 * Shared Gemini REST adapter for curriculum embeddings, lesson generation, and
 * quiz generation. The app already uses raw HttpURLConnection calls to Gemini,
 * so this keeps the new backend module compatible without introducing a new SDK.
 *
 * Required environment/configuration:
 * - GEMINI_API_KEY supplied through Gradle property, environment variable, or
 *   local.properties. app/build.gradle.kts already maps it into BuildConfig.
 */
class GeminiRestClient(
    private val apiKeyProvider: () -> String = { BuildConfig.GEMINI_API_KEY.trim() },
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    suspend fun generateContent(
        model: String,
        userPrompt: String,
        systemInstruction: String? = null,
        generationConfig: GeminiGenerationConfig = GeminiGenerationConfig()
    ): String {
        val body = buildJsonObject {
            systemInstruction?.takeIf { it.isNotBlank() }?.let { instruction ->
                put(
                    "systemInstruction",
                    buildJsonObject {
                        putJsonArray("parts") {
                            add(textPart(instruction))
                        }
                    }
                )
            }
            putJsonArray("contents") {
                add(
                    buildJsonObject {
                        put("role", "user")
                        putJsonArray("parts") {
                            add(textPart(userPrompt))
                        }
                    }
                )
            }
            put(
                "generationConfig",
                buildJsonObject {
                    put("temperature", generationConfig.temperature)
                    put("topP", generationConfig.topP)
                    put("maxOutputTokens", generationConfig.maxOutputTokens)
                    generationConfig.responseMimeType?.let { put("responseMimeType", it) }
                }
            )
        }
        val response = requestWithRetry(
            model = model,
            method = "generateContent",
            body = body,
            maxRetries = generationConfig.maxRetries
        )
        return json.parseToJsonElement(response)
            .jsonObject["candidates"]?.jsonArray?.firstOrNull()
            ?.jsonObject?.get("content")?.jsonObject?.get("parts")?.jsonArray?.firstOrNull()
            ?.jsonObject?.get("text")?.jsonPrimitive?.content
            ?.takeIf { it.isNotBlank() }
            ?: throw GeminiApiException(200, "Gemini returned no text")
    }

    suspend fun embedText(
        text: String,
        model: String,
        maxRetries: Int = DEFAULT_MAX_RETRIES
    ): List<Double> {
        val body = buildJsonObject {
            put("model", "models/${model.normalizeModelName()}")
            put(
                "content",
                buildJsonObject {
                    putJsonArray("parts") {
                        add(textPart(text))
                    }
                }
            )
        }
        val response = requestWithRetry(
            model = model,
            method = "embedContent",
            body = body,
            maxRetries = maxRetries
        )
        val values = json.parseToJsonElement(response)
            .jsonObject["embedding"]?.jsonObject?.get("values")?.jsonArray
            ?: throw GeminiApiException(200, "Gemini embedding response did not include values")
        return values.map { it.jsonPrimitive.double }
    }

    private suspend fun requestWithRetry(
        model: String,
        method: String,
        body: JsonObject,
        maxRetries: Int
    ): String {
        var attempt = 0
        var backoffMs = INITIAL_BACKOFF_MS
        while (true) {
            try {
                return requestOnce(model, method, body)
            } catch (failure: GeminiApiException) {
                val retryable = failure.statusCode == 429 || failure.statusCode == 503
                if (!retryable || attempt >= maxRetries) throw failure
                delay(backoffMs)
                backoffMs *= 2
                attempt += 1
            }
        }
    }

    private suspend fun requestOnce(model: String, method: String, body: JsonObject): String = withContext(Dispatchers.IO) {
        val apiKey = apiKeyProvider().trim()
        if (apiKey.isBlank()) {
            throw GeminiApiException(401, "GEMINI_API_KEY is not configured")
        }
        val url = URL("https://generativelanguage.googleapis.com/v1beta/models/${model.normalizeModelName()}:$method?key=$apiKey")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
        }
        try {
            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(json.encodeToString<JsonElement>(body))
            }
            val responseCode = connection.responseCode
            val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (responseCode !in 200..299) {
                throw GeminiApiException(responseCode, parseError(responseCode, response))
            }
            response
        } finally {
            connection.disconnect()
        }
    }

    private fun parseError(responseCode: Int, response: String): String {
        return runCatching {
            val error = json.parseToJsonElement(response).jsonObject["error"]?.jsonObject
            val status = error?.get("status")?.jsonPrimitive?.content
            val message = error?.get("message")?.jsonPrimitive?.content
            listOfNotNull("Gemini HTTP $responseCode", status, message).joinToString(": ")
        }.getOrDefault("Gemini HTTP $responseCode")
    }

    private fun textPart(text: String): JsonObject = buildJsonObject {
        put("text", text)
    }

    private fun String.normalizeModelName(): String =
        removePrefix("models/").trim()

    private companion object {
        const val DEFAULT_MAX_RETRIES = 3
        const val INITIAL_BACKOFF_MS = 500L
        const val CONNECT_TIMEOUT_MS = 12_000
        const val READ_TIMEOUT_MS = 30_000
    }
}

data class GeminiGenerationConfig(
    val temperature: Double = 0.3,
    val topP: Double = 0.85,
    val maxOutputTokens: Int = 4_096,
    val responseMimeType: String? = "application/json",
    val maxRetries: Int = 3
)

class GeminiApiException(
    val statusCode: Int,
    override val message: String
) : Exception(message)
