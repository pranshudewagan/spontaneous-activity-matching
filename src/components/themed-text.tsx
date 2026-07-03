import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { DisplayFont, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'display' | 'title' | 'body' | 'label' | 'caption'
      | 'default' | 'small' | 'smallBold' | 'subtitle'
      | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'ink'] },
        type === 'display'   && styles.display,
        type === 'title'     && styles.title,
        type === 'body'      && styles.body,
        type === 'label'     && styles.label,
        type === 'caption'   && styles.caption,
        // legacy
        type === 'default'   && styles.body,
        type === 'small'     && styles.label,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle'  && styles.subtitle,
        type === 'link'      && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code'      && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // DESIGN.md type scale — display + title use Plus Jakarta Sans
  display:  { fontSize: 28, fontFamily: DisplayFont, lineHeight: 34 },
  title:    { fontSize: 20, fontFamily: DisplayFont, lineHeight: 26 },
  body:     { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  label:    { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  caption:  { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  // legacy
  smallBold:    { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  subtitle:     { fontSize: 32, lineHeight: 44, fontWeight: '600' },
  link:         { lineHeight: 30, fontSize: 14 },
  linkPrimary:  { lineHeight: 30, fontSize: 14, color: '#2AAFA8' },
  code: {
    fontFamily: Fonts?.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 12,
  },
});
