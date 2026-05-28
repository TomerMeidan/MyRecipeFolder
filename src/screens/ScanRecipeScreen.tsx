import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { ParsedRecipe } from '../utils/recipeParser';
import { parseRecipeFromImage } from '../utils/aiParser';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

type Step = 'pick' | 'preview' | 'analyzing' | 'done';

// ── Language options ──────────────────────────────────────────────────────────

interface LangOption { code: string; label: string; native: string; }

const LANGUAGES: LangOption[] = [
  { code: 'en',  label: 'English',    native: 'English'    },
  { code: 'he',  label: 'Hebrew',     native: 'עברית'      },
  { code: 'ar',  label: 'Arabic',     native: 'العربية'    },
  { code: 'fr',  label: 'French',     native: 'Français'   },
  { code: 'de',  label: 'German',     native: 'Deutsch'    },
  { code: 'it',  label: 'Italian',    native: 'Italiano'   },
  { code: 'es',  label: 'Spanish',    native: 'Español'    },
  { code: 'pt',  label: 'Portuguese', native: 'Português'  },
  { code: 'ru',  label: 'Russian',    native: 'Русский'    },
  { code: 'zh',  label: 'Chinese',    native: '中文'        },
  { code: 'ja',  label: 'Japanese',   native: '日本語'      },
  { code: 'ko',  label: 'Korean',     native: '한국어'      },
];

const QUICK_SOURCE = [
  { code: '',   label: 'Auto' },
  { code: 'he', label: 'HE'   },
  { code: 'en', label: 'EN'   },
  { code: 'fr', label: 'FR'   },
  { code: 'es', label: 'ES'   },
  { code: 'de', label: 'DE'   },
  { code: 'ar', label: 'AR'   },
];

const QUICK_OUTPUT = [
  { code: '',   label: 'Original' },
  { code: 'en', label: 'English'  },
  { code: 'he', label: 'Hebrew'   },
  { code: 'fr', label: 'French'   },
];

function langName(code: string): string {
  if (!code) return 'Original language';
  return LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}

// ── Language picker modal ─────────────────────────────────────────────────────

interface PickerProps {
  visible: boolean;
  selected: string;
  includeAuto?: boolean;
  title: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

function LangPickerModal({ visible, selected, includeAuto, title, onSelect, onClose }: PickerProps) {
  const { theme } = useTheme();
  const items = includeAuto
    ? [{ code: '', label: 'Auto-detect', native: '' }, ...LANGUAGES]
    : [{ code: '', label: 'Keep original language', native: '' }, ...LANGUAGES];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose} />
      <SafeAreaView style={[pickerStyles.sheet, { backgroundColor: theme.card }]}>
        <View style={[pickerStyles.header, { borderBottomColor: theme.border }]}>
          <Text style={[pickerStyles.title, { color: theme.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[pickerStyles.close, { color: theme.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => {
            const active = item.code === selected;
            return (
              <TouchableOpacity
                style={[pickerStyles.row, { borderBottomColor: theme.border }, active && { backgroundColor: theme.primaryLight }]}
                onPress={() => { onSelect(item.code); onClose(); }}
              >
                <Text style={[pickerStyles.rowLabel, { color: theme.text }, active && { color: theme.primary, fontWeight: '600' }]}>
                  {item.label}
                </Text>
                {item.native ? <Text style={[pickerStyles.rowNative, { color: theme.textSecondary }]}>{item.native}</Text> : null}
                {active && <Text style={[pickerStyles.rowCheck, { color: theme.primary }]}>✓</Text>}
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:   { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', paddingBottom: 12 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  title:   { fontSize: 17, fontWeight: '700' },
  close:   { fontSize: 16 },
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  rowLabel:  { fontSize: 15, flex: 1 },
  rowNative: { fontSize: 14, marginRight: 10 },
  rowCheck:  { fontSize: 16, fontWeight: '700' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ScanRecipeScreen() {
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();

  const [step, setStep]               = useState<Step>('pick');
  const [imageUri, setImageUri]       = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | undefined>();
  const [sourceLang, setSourceLang]   = useState('');
  const [outputLang, setOutputLang]   = useState('');
  const [parsed, setParsed]           = useState<ParsedRecipe | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [showSrcPicker, setShowSrcPicker] = useState(false);
  const [showOutPicker, setShowOutPicker] = useState(false);

  const requireKey = () => {
    if (!GEMINI_API_KEY) {
      Alert.alert('API Key Missing', 'Set EXPO_PUBLIC_GEMINI_API_KEY in your .env file.');
      return false;
    }
    return true;
  };

  // ── Image picking (allowsEditing = native crop UI built into the picker) ──────

  const pickImage = async (fromCamera: boolean) => {
    let result: ImagePicker.ImagePickerResult;
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,   // ← native crop happens inside the camera UI
        quality: 1,
      });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Photo library access is required.'); return; }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,   // ← native crop happens inside the photo picker
        quality: 1,
      });
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      // Compress to max 1024px after native crop to keep API payload small
      const maxDim = 1024;
      const scale  = Math.min(1, maxDim / Math.max(asset.width, asset.height));
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        scale < 1 ? [{ resize: { width: Math.round(asset.width * scale) } }] : [],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      setImageUri(compressed.uri);
      setImageBase64(compressed.base64 ?? null);
      setImageFileName(asset.fileName ?? undefined);
      setStep('preview');
    }
  };

  // ── Analyze ───────────────────────────────────────────────────────────────────

  const handleAnalyze = async (src = sourceLang, out = outputLang) => {
    if (!requireKey() || !imageBase64 || !imageUri) return;
    setErrorMsg(null);
    setStep('analyzing');
    try {
      const result = await parseRecipeFromImage(
        imageBase64, imageUri, GEMINI_API_KEY,
        {
          sourceLanguage: src ? langName(src) : undefined,
          outputLanguage: out ? langName(out) : undefined,
        },
        imageFileName,
      );
      setParsed(result);
      setStep('done');
    } catch (e: any) {
      const msg: string = e?.message ?? 'Unknown error';
      console.error('[Gemini]', msg);
      setErrorMsg(msg);
      setStep('preview');
    }
  };

  const handleReset = () => {
    setStep('pick');
    setImageUri(null); setImageBase64(null); setImageFileName(undefined);
    setSourceLang(''); setOutputLang(''); setParsed(null); setErrorMsg(null);
  };

  const styles = makeStyles(theme);

  // ── Analyzing ─────────────────────────────────────────────────────────────────

  if (step === 'analyzing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.statusMsg}>Analyzing recipe…</Text>
        <Text style={styles.statusHint}>🤖 Gemini 2.5 Flash</Text>
        <Text style={styles.statusModel}>gemini-2.5-flash</Text>
      </View>
    );
  }

  // ── Pick ──────────────────────────────────────────────────────────────────────

  if (step === 'pick') {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Scan a Recipe</Text>
        <Text style={styles.subtitle}>
          Take a photo or upload a recipe page.{'\n'}
          You can crop the image in the next step.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => pickImage(true)}>
          <Text style={styles.btnIcon}>📷</Text>
          <Text style={styles.primaryBtnText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage(false)}>
          <Text style={styles.btnIcon}>🖼</Text>
          <Text style={styles.secondaryBtnText}>Choose from Library</Text>
        </TouchableOpacity>
        {!GEMINI_API_KEY && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠ EXPO_PUBLIC_GEMINI_API_KEY is not set.{'\n'}Add it to your .env file.
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────────

  if (step === 'preview') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.previewScroll}>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
        )}

        {errorMsg && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerTitle}>Analysis failed</Text>
            <Text style={styles.errorBannerMsg}>{errorMsg}</Text>
          </View>
        )}

        {/* Language settings */}
        <View style={styles.langCard}>
          <Text style={styles.langCardLabel}>Recipe is written in</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
            {QUICK_SOURCE.map((l) => {
              const active = sourceLang === l.code;
              return (
                <TouchableOpacity key={l.code} style={[styles.quickChip, active && styles.quickChipActive]} onPress={() => setSourceLang(l.code)}>
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{l.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.quickChip} onPress={() => setShowSrcPicker(true)}>
              <Text style={styles.quickChipText}>More ▾</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.langDivider} />

          <Text style={styles.langCardLabel}>Output language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
            {QUICK_OUTPUT.map((l) => {
              const active = outputLang === l.code;
              return (
                <TouchableOpacity key={l.code} style={[styles.quickChip, active && styles.quickChipActive]} onPress={() => setOutputLang(l.code)}>
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{l.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.quickChip} onPress={() => setShowOutPicker(true)}>
              <Text style={styles.quickChipText}>More ▾</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.ghostBtn} onPress={handleReset}>
            <Text style={styles.ghostBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, styles.flex1]} onPress={() => handleAnalyze()}>
            <Text style={styles.primaryBtnText}>Analyze Recipe 🤖</Text>
          </TouchableOpacity>
        </View>

        <LangPickerModal visible={showSrcPicker} selected={sourceLang} includeAuto
          title="Recipe language" onSelect={setSourceLang} onClose={() => setShowSrcPicker(false)} />
        <LangPickerModal visible={showOutPicker} selected={outputLang}
          title="Output language" onSelect={setOutputLang} onClose={() => setShowOutPicker(false)} />
      </ScrollView>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.doneScroll}>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.previewSmall} resizeMode="contain" />
      )}

      {parsed && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryTitleRow}>
            <Text style={[styles.summaryTitle, { flex: 1 }]}>{parsed.title || 'Untitled Recipe'}</Text>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>🤖 Gemini 2.5 Flash</Text>
            </View>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{parsed.category}</Text>
          </View>
          {outputLang ? <Text style={styles.outputLangNote}>📝 Output: {langName(outputLang)}</Text> : null}
          <Text style={styles.summaryLine}>{parsed.ingredients.length} ingredient{parsed.ingredients.length !== 1 ? 's' : ''}</Text>
          <Text style={styles.summaryLine}>{parsed.steps.length} step{parsed.steps.length !== 1 ? 's' : ''}</Text>
        </View>
      )}

      <View style={styles.reanalyzCard}>
        <Text style={styles.reanalyzLabel}>Change output language</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {QUICK_OUTPUT.map((l) => {
            const active = outputLang === l.code;
            return (
              <TouchableOpacity key={l.code} style={[styles.quickChip, active && styles.quickChipActive]}
                onPress={() => { setOutputLang(l.code); handleAnalyze(sourceLang, l.code); }}>
                <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{l.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.quickChip} onPress={() => setShowOutPicker(true)}>
            <Text style={styles.quickChipText}>More ▾</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('AddEditRecipe', { prefill: parsed ?? undefined })}>
        <Text style={styles.primaryBtnText}>Review & Save Recipe →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.ghostBtn} onPress={handleReset}>
        <Text style={styles.ghostBtnText}>Scan Another</Text>
      </TouchableOpacity>

      <LangPickerModal visible={showOutPicker} selected={outputLang}
        title="Output language"
        onSelect={(c) => { setOutputLang(c); handleAnalyze(sourceLang, c); }}
        onClose={() => setShowOutPicker(false)} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: theme.background },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
    statusMsg:    { marginTop: 16, fontSize: 16, color: theme.text, fontWeight: '600' },
    statusHint:   { marginTop: 6, fontSize: 13, color: theme.textSecondary },
    statusModel:  { marginTop: 4, fontSize: 11, color: theme.textSecondary, opacity: 0.6 },
    previewScroll: { paddingBottom: 32 },
    doneScroll:   { padding: 16, paddingBottom: 40 },

    heading:  { fontSize: 26, fontWeight: '700', color: theme.text, textAlign: 'center', marginTop: 48, marginBottom: 12 },
    subtitle: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 22, marginHorizontal: 32, marginBottom: 40 },

    primaryBtn: {
      backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 16,
      alignItems: 'center', marginHorizontal: 16, marginBottom: 12,
      flexDirection: 'row', justifyContent: 'center',
    },
    primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    secondaryBtn: {
      backgroundColor: theme.card, borderRadius: 14, paddingVertical: 16,
      alignItems: 'center', marginHorizontal: 16, marginBottom: 12,
      borderWidth: 1.5, borderColor: theme.primary, flexDirection: 'row', justifyContent: 'center',
    },
    secondaryBtnText: { fontSize: 16, fontWeight: '600', color: theme.primary },
    btnIcon:   { fontSize: 20, marginRight: 10 },
    ghostBtn:  { paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 12 },
    ghostBtnText: { fontSize: 15, color: theme.textSecondary, fontWeight: '500' },
    flex1:     { flex: 1, marginHorizontal: 8 },

    preview:      { width: '100%', height: 300, backgroundColor: '#000' },
    previewSmall: { width: '100%', height: 180, backgroundColor: '#000', borderRadius: 12, marginBottom: 16 },
    actionRow:    { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 },

    errorBanner:      { backgroundColor: '#FFEBEE', borderRadius: 10, padding: 14, marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: '#EF9A9A' },
    errorBannerTitle: { fontSize: 14, fontWeight: '700', color: '#C62828', marginBottom: 4 },
    errorBannerMsg:   { fontSize: 13, color: '#B71C1C', lineHeight: 18 },

    warningBox:  { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 14, marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderColor: '#FFD54F' },
    warningText: { fontSize: 13, color: '#795548', lineHeight: 20 },

    langCard:      { backgroundColor: theme.card, margin: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: theme.border },
    langCardLabel: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
    langDivider:   { height: 1, backgroundColor: theme.border, marginVertical: 14 },
    quickRow:      { flexDirection: 'row', gap: 8, paddingBottom: 2 },
    quickChip:          { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
    quickChipActive:    { backgroundColor: theme.primaryLight, borderColor: theme.primary },
    quickChipText:      { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
    quickChipTextActive: { color: theme.primary },

    summaryCard:     { backgroundColor: theme.card, borderRadius: 14, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    summaryTitleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    summaryTitle:    { fontSize: 19, fontWeight: '700', color: theme.text },
    aiBadge:         { backgroundColor: '#EDE7F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8, marginTop: 2 },
    aiBadgeText:     { fontSize: 11, fontWeight: '600', color: '#6A1B9A' },
    pill:            { alignSelf: 'flex-start', backgroundColor: theme.primaryLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
    pillText:        { fontSize: 12, color: theme.primary, fontWeight: '500' },
    outputLangNote:  { fontSize: 13, color: theme.textSecondary, marginBottom: 6 },
    summaryLine:     { fontSize: 14, color: theme.textSecondary, marginTop: 4 },

    reanalyzCard:  { backgroundColor: theme.card, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
    reanalyzLabel: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  });
}
