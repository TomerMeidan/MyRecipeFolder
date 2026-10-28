import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(t('login_missing'));
      return;
    }
    setError('');
    setLoading(true);
    const err = await login(email, password);
    setLoading(false);
    if (err) setError(err);
  };

  const styles = makeStyles(theme);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* The app icon itself, so login and home screen show the same mark */}
        <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text style={styles.title}>My Recipe Folder</Text>
        <Text style={styles.subtitle}>{t('login_subtitle')}</Text>

        <Text style={styles.label}>{t('email')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }}
          placeholder={t('email_placeholder')}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          returnKeyType="next"
          accessibilityLabel={t('email')}
        />

        <Text style={styles.label}>{t('password')}</Text>
        <View style={styles.passRow}>
          <TextInput
            style={[styles.input, styles.passInput]}
            value={password}
            onChangeText={(v) => { setPassword(v); setError(''); }}
            placeholder={t('password_placeholder')}
            placeholderTextColor={theme.textSecondary}
            secureTextEntry={!showPass}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            accessibilityLabel={t('password')}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPass((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={t(showPass ? 'hide_password' : 'show_password')}
          >
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.text} />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={theme.errorText} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading
            ? <ActivityIndicator color={theme.onPrimary} />
            : <Text style={styles.loginBtnText}>{t('sign_in')}</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: theme.background },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, width: '100%', maxWidth: 440, alignSelf: 'center' },

    logo: { width: 80, height: 80, borderRadius: 18, alignSelf: 'center', marginBottom: 16 },
    title:    { fontSize: 30, fontWeight: '800', textAlign: 'center', color: theme.text, marginBottom: 4 },
    subtitle: { fontSize: 17, textAlign: 'center', color: theme.textSecondary, marginBottom: 28 },

    label: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 6, marginTop: 16 },
    input: {
      minHeight: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, fontSize: 17,
      backgroundColor: theme.card, borderColor: theme.borderStrong, color: theme.text,
    },

    passRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    passInput: { flex: 1 },
    eyeBtn:    {
      width: 52, height: 52, borderRadius: 12, borderWidth: 1.5,
      borderColor: theme.borderStrong, alignItems: 'center', justifyContent: 'center',
    },

    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
      padding: 12, borderRadius: 10, backgroundColor: theme.errorBox,
    },
    error: { flex: 1, color: theme.errorText, fontSize: 15, fontWeight: '600' },

    loginBtn:         { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24, backgroundColor: theme.primary },
    loginBtnDisabled: { opacity: 0.6 },
    loginBtnText:     { fontSize: 17, fontWeight: '800', color: theme.onPrimary },
  });
}
