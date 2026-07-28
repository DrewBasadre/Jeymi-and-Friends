import {
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  BookOpen,
  Bot,
  ChartNoAxesColumnIncreasing,
  House,
  LayoutDashboard,
  ScanLine,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LandingScreen,
  LearningAssessmentScreen,
  RoleScreen,
  StudentLoginScreen,
  StudentSetupScreen,
  TeacherLoginScreen,
} from '@/screens/AuthScreens';
import {
  FlashcardsScreen,
  ModuleReaderScreen,
  ModulesScreen,
  QuizReportScreen,
  QuizResultScreen,
  QuizScreen,
  ReportsScreen,
  StudentHomeScreen,
  StudentProfileScreen,
} from '@/screens/StudentScreens';
import { ReceiveTransferScreen } from '@/screens/TransferScreens';
import { StudentScanScreen } from '@/screens/StudentScanScreen';
import {
  AssignmentBuilderScreen,
  SectionsScreen,
} from '@/screens/TeacherOfflineScreens';
import { ModuleAuthorScreen } from '@/screens/ModuleAuthorScreen';
import {
  CustomReviewSetsScreen,
  ParentDigestScreen,
  ReviewHubScreen,
} from '@/screens/ReviewScreens';
import {
  GurobotScreen,
  LearnerDetailScreen,
  RecordBookScreen,
  ScannerScreen,
  TeacherHomeScreen,
  TransferScreen,
} from '@/screens/TeacherScreens';
import { useSessionStore } from '@/store/session';
import { colors, elevation, layout, radius } from '@/theme/tokens';
import type {
  RootStackParamList,
  StudentTabParamList,
  TeacherTabParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const StudentTabs = createBottomTabNavigator<StudentTabParamList>();
const TeacherTabs = createBottomTabNavigator<TeacherTabParamList>();

const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.ink,
    border: colors.outline,
    notification: colors.accent,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '600' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '900' },
  },
};

function useTabScreenOptions() {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.inkSubtle,
    tabBarHideOnKeyboard: true,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '700' as const,
      letterSpacing: 0.1,
      marginTop: 3,
    },
    tabBarItemStyle: { paddingTop: 8 },
    tabBarStyle: {
      height: layout.tabBarHeight + insets.bottom,
      paddingTop: 8,
      paddingBottom: Math.max(insets.bottom, 8),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outline,
      backgroundColor: colors.surface,
      // Lifts the bar off the content so long lists scroll "under" it.
      ...elevation.e2,
    },
  } as const;
}

/**
 * Tab icon with a tinted pill behind the active item — the smallest possible
 * cue that reads as "you are here" without adding chrome.
 */
function TabIcon({
  icon: Icon,
  color,
  size,
  focused,
}: {
  icon: LucideIcon;
  color: string;
  size: number;
  focused: boolean;
}) {
  return (
    <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
      <Icon color={color} size={size - 1} strokeWidth={focused ? 2.6 : 2.05} />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: {
    width: 50,
    height: 30,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapActive: { backgroundColor: colors.primaryTint },
});

function StudentTabNavigator() {
  const screenOptions = useTabScreenOptions();
  return (
    <StudentTabs.Navigator screenOptions={screenOptions}>
      <StudentTabs.Screen
        name="StudentHome"
        component={StudentHomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: (props) => <TabIcon icon={House} {...props} />,
        }}
      />
      <StudentTabs.Screen
        name="Modules"
        component={ModulesScreen}
        options={{
          title: 'Modules',
          tabBarIcon: (props) => <TabIcon icon={BookOpen} {...props} />,
        }}
      />
      <StudentTabs.Screen
        name="StudentScan"
        component={StudentScanScreen}
        options={{
          title: 'Scan',
          tabBarIcon: (props) => <TabIcon icon={ScanLine} {...props} />,
        }}
      />
      <StudentTabs.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          title: 'Reports',
          tabBarIcon: (props) => (
            <TabIcon icon={ChartNoAxesColumnIncreasing} {...props} />
          ),
        }}
      />
      <StudentTabs.Screen
        name="Profile"
        component={StudentProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: (props) => <TabIcon icon={UserRound} {...props} />,
        }}
      />
    </StudentTabs.Navigator>
  );
}

function TeacherTabNavigator() {
  const screenOptions = useTabScreenOptions();
  return (
    <TeacherTabs.Navigator screenOptions={screenOptions}>
      <TeacherTabs.Screen
        name="TeacherHome"
        component={TeacherHomeScreen}
        options={{
          title: 'Overview',
          tabBarIcon: (props) => <TabIcon icon={LayoutDashboard} {...props} />,
        }}
      />
      <TeacherTabs.Screen
        name="RecordBook"
        component={RecordBookScreen}
        options={{
          title: 'Class',
          tabBarIcon: (props) => <TabIcon icon={UsersRound} {...props} />,
        }}
      />
      <TeacherTabs.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{
          title: 'Scan',
          tabBarIcon: (props) => <TabIcon icon={ScanLine} {...props} />,
        }}
      />
      <TeacherTabs.Screen
        name="Gurobot"
        component={GurobotScreen}
        options={{
          title: 'Assist',
          tabBarIcon: (props) => <TabIcon icon={Bot} {...props} />,
        }}
      />
    </TeacherTabs.Navigator>
  );
}

export function RootNavigator() {
  const student = useSessionStore((state) => state.student);
  const initialRouteName: keyof RootStackParamList = student
    ? 'StudentTabs'
    : 'Landing';

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <RootStack.Screen name="Landing" component={LandingScreen} />
        <RootStack.Screen name="Role" component={RoleScreen} />
        <RootStack.Screen name="StudentLogin" component={StudentLoginScreen} />
        <RootStack.Screen name="StudentSetup" component={StudentSetupScreen} />
        <RootStack.Screen
          name="LearningAssessment"
          component={LearningAssessmentScreen}
        />
        <RootStack.Screen name="StudentTabs" component={StudentTabNavigator} />
        <RootStack.Screen name="ModuleReader" component={ModuleReaderScreen} />
        <RootStack.Screen name="Quiz" component={QuizScreen} />
        <RootStack.Screen name="QuizResult" component={QuizResultScreen} />
        <RootStack.Screen name="Flashcards" component={FlashcardsScreen} />
        <RootStack.Screen name="ReviewHub" component={ReviewHubScreen} />
        <RootStack.Screen
          name="CustomReviewSets"
          component={CustomReviewSetsScreen}
        />
        <RootStack.Screen name="ParentDigest" component={ParentDigestScreen} />
        <RootStack.Screen name="QuizReport" component={QuizReportScreen} />
        <RootStack.Screen name="TeacherLogin" component={TeacherLoginScreen} />
        <RootStack.Screen name="TeacherTabs" component={TeacherTabNavigator} />
        <RootStack.Screen name="Sections" component={SectionsScreen} />
        <RootStack.Screen
          name="AssignmentBuilder"
          component={AssignmentBuilderScreen}
        />
        <RootStack.Screen name="LearnerDetail" component={LearnerDetailScreen} />
        <RootStack.Screen name="ModuleAuthor" component={ModuleAuthorScreen} />
        <RootStack.Screen name="Transfer" component={TransferScreen} />
        <RootStack.Screen
          name="ReceiveTransfer"
          component={ReceiveTransferScreen}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
