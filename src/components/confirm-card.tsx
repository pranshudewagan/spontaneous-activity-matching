import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

// A modal-style confirmation card that stays inside the app tree — unlike
// Alert.alert, this doesn't dismiss the keyboard and matches the app's
// palette + type. Two shapes:
//   - Confirm + cancel: pass onCancel; renders both buttons.
//   - Info-only:        omit onCancel; a single "OK" button dismisses.
type Props = {
  title:           string;
  body?:           string;
  confirmLabel?:   string; // default 'OK'
  cancelLabel?:    string; // default 'Cancel'
  destructive?:    boolean;
  onConfirm:       () => void;
  onCancel?:       () => void;
};

export function ConfirmCard({
  title,
  body,
  confirmLabel = 'OK',
  cancelLabel  = 'Cancel',
  destructive  = false,
  onConfirm,
  onCancel,
}: Props) {
  const theme        = Colors.light;
  const confirmColor = destructive ? theme.danger : theme.action;
  const backdropDismiss = onCancel ?? onConfirm;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={backdropDismiss} />
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <ThemedText
          style={[styles.title, { color: theme.ink }, !body && styles.titleNoBody]}
        >
          {title}
        </ThemedText>
        {body && (
          <ThemedText style={[styles.body, { color: theme.muted }]}>{body}</ThemedText>
        )}
        <View style={[styles.divider, { backgroundColor: theme.line }]} />
        <View style={styles.actions}>
          {onCancel && (
            <>
              <Pressable
                style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
                onPress={onCancel}
              >
                <ThemedText style={[styles.btnLabel, { color: theme.ink }]}>{cancelLabel}</ThemedText>
              </Pressable>
              <View style={[styles.btnDivider, { backgroundColor: theme.line }]} />
            </>
          )}
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
            onPress={onConfirm}
          >
            <ThemedText style={[styles.btnLabel, { color: confirmColor }]}>{confirmLabel}</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex:          200,
    alignItems:     'center',
    justifyContent: 'center',
  },
  card: {
    width:         280,
    borderRadius:  16,
    overflow:     'hidden',
    shadowColor:  '#000',
    shadowOpacity: 0.16,
    shadowRadius:  20,
    shadowOffset: { width: 0, height: 8 },
    elevation:     12,
  },
  title: {
    fontSize:          16,
    fontWeight:        '700',
    textAlign:         'center',
    paddingTop:        Spacing.three + 4,
    paddingHorizontal: Spacing.three,
  },
  titleNoBody: {
    paddingBottom: Spacing.three,
  },
  body: {
    fontSize:          13,
    textAlign:         'center',
    paddingTop:        Spacing.one + 2,
    paddingBottom:     Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  divider: { height: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row' },
  btn: {
    flex:            1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two + 4,
  },
  btnLabel: {
    fontSize:   15,
    fontWeight: '500',
  },
  btnDivider: { width: StyleSheet.hairlineWidth },
});
