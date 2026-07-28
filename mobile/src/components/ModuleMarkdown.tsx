import { useMemo } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { File } from 'expo-file-system';
import Markdown, {
  MarkdownIt,
  type RenderRules,
} from 'react-native-markdown-display';
import { colors, radius, spacing, text } from '@/theme/tokens';

const markdownParser = MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});

export function ModuleMarkdown({
  markdown,
  moduleDirectoryUri,
  onTaggedTermPress,
}: {
  markdown: string;
  moduleDirectoryUri: string | null;
  onTaggedTermPress?: (term: string) => void;
}) {
  const rules = useMemo<RenderRules>(
    () => ({
      image: (node) => {
        const source = resolveLocalImage(
          String(node.attributes.src ?? ''),
          moduleDirectoryUri,
        );
        if (!source) {
          return (
            <View key={node.key} style={styles.unavailableImage}>
              <Text style={styles.unavailableText}>
                {String(node.attributes.alt ?? 'Lesson image')} is unavailable.
              </Text>
            </View>
          );
        }
        return (
          <Image
            key={node.key}
            accessibilityLabel={String(
              node.attributes.alt ?? 'Lesson image',
            )}
            resizeMode="contain"
            source={{ uri: source }}
            style={styles.image}
          />
        );
      },
      code_inline: (node) => (
        <Text
          accessibilityRole={onTaggedTermPress ? 'button' : undefined}
          key={node.key}
          onPress={
            onTaggedTermPress
              ? () => onTaggedTermPress(node.content)
              : undefined
          }
          style={markdownStyles.code_inline}
        >
          {node.content}
        </Text>
      ),
    }),
    [moduleDirectoryUri, onTaggedTermPress],
  );

  return (
    <Markdown
      markdownit={markdownParser}
      onLinkPress={() => false}
      rules={rules}
      style={markdownStyles}
    >
      {markdown}
    </Markdown>
  );
}

export function markdownToPlainText(markdown: string): string {
  const tokens = markdownParser.parse(markdown, {}) as Array<{
    type: string;
    content: string;
    children?: Array<{ type: string; content: string }>;
  }>;
  const lines: string[] = [];
  for (const token of tokens) {
    if (token.type === 'inline' && token.children) {
      const text = token.children
        .map((child) => {
          if (child.type === 'softbreak' || child.type === 'hardbreak') return '\n';
          if (
            child.type === 'text' ||
            child.type === 'code_inline' ||
            child.type === 'image'
          ) {
            return child.content;
          }
          return '';
        })
        .join('')
        .trim();
      if (text) lines.push(text);
    } else if (token.type === 'fence' || token.type === 'code_block') {
      const text = token.content.trim();
      if (text) lines.push(text);
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function resolveLocalImage(
  source: string,
  moduleDirectoryUri: string | null,
): string | null {
  if (!moduleDirectoryUri || !source) return null;
  let normalized: string;
  try {
    normalized = decodeURIComponent(source).replace(/^\.\//, '');
  } catch {
    return null;
  }
  const segments = normalized.split('/');
  if (
    normalized.startsWith('/') ||
    normalized.includes('\\') ||
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        !/^[a-zA-Z0-9._-]+$/.test(segment),
    )
  ) {
    return null;
  }
  const file = new File(moduleDirectoryUri, normalized);
  return file.exists ? file.uri : null;
}

const markdownStyles = StyleSheet.create({
  body: {
    ...text.body,
    color: colors.ink,
    lineHeight: 28,
  },
  heading1: {
    ...text.h1,
    color: colors.ink,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  heading2: {
    ...text.h2,
    color: colors.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  heading3: {
    ...text.title,
    color: colors.ink,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  paragraph: {
    marginBottom: spacing.md,
  },
  bullet_list: {
    marginBottom: spacing.md,
  },
  ordered_list: {
    marginBottom: spacing.md,
  },
  blockquote: {
    backgroundColor: colors.surfaceMuted,
    borderLeftColor: colors.primary,
    borderLeftWidth: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // Tappable "recall term" — a filled pill so students can tell it is
  // interactive; kept distinct from real links (which stay underlined).
  code_inline: {
    backgroundColor: colors.primaryTint,
    color: colors.primary,
    fontWeight: '700',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fence: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.outline,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.ink,
    fontFamily: 'monospace',
    padding: spacing.md,
  },
  link: {
    color: colors.secondary,
    textDecorationLine: 'underline',
  },
});

const styles = StyleSheet.create({
  image: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 420,
    marginBottom: spacing.md,
  },
  unavailableImage: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.outline,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  unavailableText: {
    ...text.label,
    color: colors.inkMuted,
    fontWeight: '400',
  },
});
