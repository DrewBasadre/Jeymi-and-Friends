// Desktop JVM build of the OMR core so the fixture suite runs without a phone.
// The Android module compiles the same sources against the OpenCV Android AAR.
plugins {
  kotlin("jvm") version "2.2.21"
}

kotlin { jvmToolchain(21) }

dependencies {
  implementation("org.openpnp:opencv:4.9.0-0")
  implementation("org.json:json:20240303")
  testImplementation(kotlin("test"))
  testImplementation("org.junit.jupiter:junit-jupiter:5.11.3")
  testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
  useJUnitPlatform()
  maxHeapSize = "2g"
  outputs.upToDateWhen { false }
  systemProperty("omr.fixtures", rootDir.resolve("../../../omr-fixtures/v1").canonicalPath)
  systemProperty("omr.writeImages", System.getenv("OMR_WRITE_IMAGES") ?: "0")
  testLogging { events("passed", "failed"); showStandardStreams = true }
}
