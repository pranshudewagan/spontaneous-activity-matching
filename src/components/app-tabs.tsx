import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const colors = Colors.light;
  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors.line}
      iconColor={{ default: colors.muted, selected: colors.action }}
      labelStyle={{ selected: { color: colors.action } }}
      disableTransparentOnScrollEdge>
      <NativeTabs.Trigger name="index">
        <Label>Discover</Label>
        <Icon sf={{ default: 'map', selected: 'map.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-plans">
        <Label>My plans</Label>
        <Icon sf={{ default: 'calendar', selected: 'calendar.circle.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
