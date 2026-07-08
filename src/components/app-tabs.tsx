import Feather from '@expo/vector-icons/Feather';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';

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
        <Icon src={<VectorIcon family={Feather} name="compass" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-plans">
        <Label>My plans</Label>
        <Icon
          sf="calendar"
          androidSrc={<VectorIcon family={Feather} name="calendar" />}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon
          sf={{ default: 'person', selected: 'person.fill' }}
          androidSrc={<VectorIcon family={Feather} name="user" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
