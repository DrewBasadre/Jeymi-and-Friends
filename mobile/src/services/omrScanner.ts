import { requireOptionalNativeModule } from 'expo-modules-core';
import { File } from 'expo-file-system';
import { omrAnalysisSchema, type AnswerSheetTemplate, type OmrAnalysis } from '@/domain/omr';

interface PavoOmrModule {
  isAvailable(): boolean;
  analyzeSheet(imageUri: string, templateJson: string, quick: boolean, saveWarped: boolean): Promise<string>;
}

const native = requireOptionalNativeModule<PavoOmrModule>('PavoOmr');

export const omrScanner = {
  isAvailable(): boolean {
    return native?.isAvailable() ?? false;
  },

  /**
   * Measures one photo on-device. `quick` is the low-cost check used while
   * waiting for a steady frame; full analysis also returns every bubble fill.
   */
  async analyze(
    imageUri: string,
    template: AnswerSheetTemplate,
    options: { quick?: boolean; saveWarped?: boolean } = {},
  ): Promise<OmrAnalysis> {
    if (!native) {
      throw new Error('The paper scanner needs the PAVO Android build with the on-device scanner.');
    }
    const raw = await native.analyzeSheet(
      imageUri,
      JSON.stringify(template),
      options.quick ?? false,
      options.saveWarped ?? false,
    );
    return omrAnalysisSchema.parse(JSON.parse(raw));
  },
};

/** Deletes a temporary capture; scan photos are kept only under the teacher's retention policy. */
export function discardScanImage(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone; nothing to clean up.
  }
}
