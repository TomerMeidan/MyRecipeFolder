import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const { theme } = useTheme();

  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [remember, setRemember]     = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setError('');
    setLoading(true);
    const ok = await login(username, password, remember);
    setLoading(false);
    if (!ok) setError('Incorrect username or password.');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo / title */}
        <Text style={styles.logo}>🍳</Text>
        <Text style={[styles.title, { color: theme.text }]}>My Recipe Folder</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Sign in to continue</Text>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>

          {/* Username */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Username</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
            value={username}
            onChangeText={(v) => { setUsername(v); setError(''); }}
            placeholder="Enter username"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          {/* Password */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
          <View style={styles.passRow}>
            <TextInput
              style={[styles.input, styles.passInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(''); }}
              placeholder="Enter password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={[styles.eyeBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
              onPress={() => setShowPass((v) => !v)}
            >
              <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Remember me */}
          <TouchableOpacity style={styles.rememberRow} onPress={() => setRemember((v) => !v)}>
            <View style={[styles.checkbox, { borderColor: theme.primary, backgroundColor: remember ? theme.primary : 'transparent' }]}>
              {remember && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.rememberText, { color: theme.textSecondary }]}>Remember me</Text>
          </TouchableOpacity>

          {/* Error */}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Login button */}
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: theme.primary }, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.loginBtnText}>Sign In</Text>
            }
          </TouchableOpacity>

        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  logo:     { fontSize: 64, textAlign: 'center', marginBottom: 12 },
  title:    { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 32 },

  card: {
    borderRadius: 16, padding: 24,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },

  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1, borderRadius: 10, padding: 14,
    fontSize: 15, flex: 1,
  },

  passRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passInput: { flex: 1 },
  eyeBtn: {
    padding: 12, borderRadius: 10, borderWidth: 1,
  },

  rememberRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkmark:    { color: '#fff', fontSize: 13, fontWeight: '700' },
  rememberText: { fontSize: 14 },

  error: { color: '#D32F2F', fontSize: 13, marginTop: 10, textAlign: 'center' },

  loginBtn: {
    borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 20,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
