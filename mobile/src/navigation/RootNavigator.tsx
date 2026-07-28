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
import {
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
import { colors } from '@/theme/tokens';
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
    primary: colors.indigo,
    background: colors.background,
    card: colors.surface,
    text: colors.ink,
    border: colors.outline,
    notification: colors.coral,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '600' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '900' },
  },
};

const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.indigo,
  tabBarInactiveTintColor: colors.inkMuted,
  tabBarHideOnKeyboard: true,
  tabBarLabelStyle: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  tabBarStyle: {
    height: 66,
    paddingTop: 7,
    paddingBottom: 8,
    borderTopColor: colors.outline,
    backgroundColor: colors.surface,
  },
};

function TabIcon({
  icon: Icon,
  color,
  size,
}: {
  icon: LucideIcon;
  color: string;
  size: number;
}) {
  return <Icon color={color} size={size} strokeWidth={2.2} />;
}

function StudentTabNavigator() {
  return (
    <StudentTabs.Navigator screenOptions={tabScreenOptions}>
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
  return (
    <TeacherTabs.Navigator screenOptions={tabScreenOptions}>
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
          title: 'Gurobot',
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
    : 'Role';

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
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
        <RootStack.Screen name="LearnerDetail" component={LearnerDetailScreen} />
        <RootStack.Screen name="Transfer" component={TransferScreen} />
        <RootStack.Screen
          name="ReceiveTransfer"
          component={ReceiveTransferScreen}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
