import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

type Segment = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

function parseInline(line: string): Segment[] {
  const result: Segment[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > last) result.push({ text: line.slice(last, match.index) });
    const m = match[0];
    if (m.startsWith('**')) result.push({ text: m.slice(2, -2), bold: true });
    else if (m.startsWith('`')) result.push({ text: m.slice(1, -1), code: true });
    else result.push({ text: m.slice(1, -1), italic: true });
    last = pattern.lastIndex;
  }

  if (last < line.length) result.push({ text: line.slice(last) });
  return result;
}

function renderInlineSpans(line: string, codeStyle: TextStyle): React.ReactNode[] {
  return parseInline(line).map((seg, i) => {
    const style: TextStyle = {};
    if (seg.bold) style.fontWeight = 'bold';
    if (seg.italic) style.fontStyle = 'italic';
    if (seg.code) Object.assign(style, codeStyle);
    return (
      <Text key={i} style={style}>
        {seg.text}
      </Text>
    );
  });
}

type MarkdownTextProps = {
  content: string;
  style?: TextStyle;
  textAlign?: 'left' | 'center' | 'right';
};

export function MarkdownText({ content, style, textAlign = 'center' }: MarkdownTextProps) {
  const theme = useAppTheme();
  const codeStyle: TextStyle = { fontFamily: 'monospace', backgroundColor: theme.surface };

  const lines = content.split('\n');

  return (
    <View style={styles.container}>
      {lines.map((line, i) => {
        if (!line.trim()) {
          return <View key={i} style={styles.gap} />;
        }

        if (line.startsWith('# ')) {
          return (
            <Text key={i} style={[styles.h1, { textAlign }, style]}>
              {line.slice(2)}
            </Text>
          );
        }

        if (line.startsWith('## ')) {
          return (
            <Text key={i} style={[styles.h2, { textAlign }, style]}>
              {line.slice(3)}
            </Text>
          );
        }

        return (
          <Text key={i} style={[styles.para, { textAlign }, style]}>
            {renderInlineSpans(line, codeStyle)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    gap: 4,
  },
  h1: {
    fontSize: 34,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
  },
  para: {
    fontSize: 28,
    lineHeight: 36,
  },
  gap: {
    height: 8,
  },
});
