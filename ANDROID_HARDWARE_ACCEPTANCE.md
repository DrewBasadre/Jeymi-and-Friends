# PAVO Android Hardware Acceptance

The automated suite and Android emulator cover schemas, persistence, rendering,
navigation, QR generation, report aggregation, and native compilation. Complete
the checks below on two physical Android devices before a classroom release.

## Profile and assignment QR

1. On the teacher device, create and activate a Section.
2. On the student device, open Profile and show the Profile QR.
3. Scan it on the teacher device.
4. Confirm the learner appears once in the active Section with the active
   Section's grade and name, plus the student's current learning format.
5. Scan the same Profile QR again and confirm the roster is updated without a
   duplicate.
6. Generate an Assignment QR for the active Section.
7. Scan it from the student's Scan tab twice.
8. Confirm tasks merge once into Deadlines and existing tasks are not replaced.

## Quiz report QR

1. Complete a quiz on the student device and open its report.
2. Scan every numbered QR part on the teacher device.
3. Confirm intermediate parts show progress and do not create a partial report.
4. Confirm the final part appends one attempt to the learner's history.
5. Confirm the score, trend, missed concepts, class average, and leaderboards
   update without adding an unrostered learner.

## Nearby module transfer

1. Enable Bluetooth, Wi-Fi, and Nearby Devices permissions on both devices.
2. Author a Markdown module with at least one WebP image on the teacher device.
3. Start Receive on the student device and Share Nearby on the teacher device.
4. Confirm both devices show the same verification code before accepting.
5. Complete the transfer and confirm the module opens offline with its image.
6. Start another transfer, disable connectivity partway through, then reconnect.
7. Retry and confirm the transfer resumes from the stored byte offset.
8. Cancel a transfer and confirm both devices return to an idle state.
9. Modify a test package after its manifest is created and confirm installation
   fails checksum verification.

## Release gate

- No internet connection is required for any check above.
- No Supabase, OTA, or callable AI request should appear in device logs.
- Both devices must use the same current PAVO Android build.
