import { useState, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Alert, ActivityIndicator, Modal, SafeAreaView,
  Dimensions, GestureResponderEvent,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { ParsedRecipe } from '../utils/recipeParser';
import {
  parseRecipeFromImage,
  ModelOption,
  ProgressUpdate,
  VISION_MODELS,
} from '../utils/aiParser';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '';

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
                style={[
                  pickerStyles.row,
                  { borderBottomColor: theme.border },
                  active && { backgroundColor: theme.primaryLight },
                ]}
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

// ── Screen and container dimensions for custom cropping ────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const MAX_CONTAINER_HEIGHT = SCREEN_HEIGHT * 0.55;
const CONTAINER_PADDING = 16;
const TARGET_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING * 2;

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ScanRecipeScreen() {
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();

  const [step, setStep]           = useState<Step>('pick');
  const [imageUri, setImageUri]   = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | undefined>();
  const [sourceLang, setSourceLang] = useState('');
  const [outputLang, setOutputLang] = useState('');
  const [parsed, setParsed]         = useState<ParsedRecipe | null>(null);
  const [usedModel, setUsedModel]   = useState<ModelOption | null>(null);
  const [progress, setProgress]     = useState<ProgressUpdate | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [showSrcPicker, setShowSrcPicker] = useState(false);
  const [showOutPicker, setShowOutPicker] = useState(false);

  // Cropping State
  const [showCropModal, setShowCropModal] = useState(false);
  const [originalWidth, setOriginalWidth] = useState<number>(0);
  const [originalHeight, setOriginalHeight] = useState<number>(0);
  const [isCropping, setIsCropping] = useState(false);
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const touchStartRef = useRef<{ pageX: number; pageY: number; box: { x: number; y: number; w: number; h: number }; handle: string | null } | null>(null);

  // Compute display dimensions for the crop container
  let displayWidth = TARGET_WIDTH;
  let displayHeight = displayWidth * (originalHeight / originalWidth || 1);

  if (displayHeight > MAX_CONTAINER_HEIGHT) {
    displayHeight = MAX_CONTAINER_HEIGHT;
    displayWidth = displayHeight * (originalWidth / originalHeight || 1);
  }

  const startCropping = (uri: string, width: number, height: number) => {
    setOriginalWidth(width);
    setOriginalHeight(height);

    let dispW = TARGET_WIDTH;
    let dispH = dispW * (height / width);

    if (dispH > MAX_CONTAINER_HEIGHT) {
      dispH = MAX_CONTAINER_HEIGHT;
      dispW = dispH * (width / height);
    }

    const initialX = dispW * 0.05;
    const initialY = dispH * 0.05;
    const initialW = dispW * 0.9;
    const initialH = dispH * 0.9;

    setBox({ x: initialX, y: initialY, w: initialW, h: initialH });
    setShowCropModal(true);
  };

  const handleOpenCrop = () => {
    if (!imageUri) return;
    if (originalWidth && originalHeight) {
      startCropping(imageUri, originalWidth, originalHeight);
    } else {
      Image.getSize(imageUri, (w, h) => {
        startCropping(imageUri, w, h);
      }, () => {
        startCropping(imageUri, 800, 1000);
      });
    }
  };

  const applyCrop = async () => {
    if (!imageUri) return;
    setIsCropping(true);

    const scaleX = originalWidth / displayWidth;
    const scaleY = originalHeight / displayHeight;

    const originX = Math.max(0, Math.min(originalWidth - 1, Math.round(box.x * scaleX)));
    const originY = Math.max(0, Math.min(originalHeight - 1, Math.round(box.y * scaleY)));
    const cropWidth = Math.max(10, Math.min(originalWidth - originX, Math.round(box.w * scaleX)));
    const cropHeight = Math.max(10, Math.min(originalHeight - originY, Math.round(box.h * scaleY)));

    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );

      setImageUri(manipResult.uri);
      setImageBase64(manipResult.base64 ?? null);
      setOriginalWidth(manipResult.width);
      setOriginalHeight(manipResult.height);
      setShowCropModal(false);
    } catch (err: any) {
      Alert.alert('Cropping error', err?.message ?? 'Failed to crop image');
    } finally {
      setIsCropping(false);
    }
  };

  const resetCropBox = () => {
    setBox({ x: 0, y: 0, w: displayWidth, h: displayHeight });
  };

  const handleTouchStart = (handle: string, event: GestureResponderEvent) => {
    const touch = event.nativeEvent;
    touchStartRef.current = {
      pageX: touch.pageX,
      pageY: touch.pageY,
      box: { ...box },
      handle,
    };
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    if (!touchStartRef.current) return;
    const { pageX, pageY, box: startBox, handle } = touchStartRef.current;
    const touch = event.nativeEvent;
    const dx = touch.pageX - pageX;
    const dy = touch.pageY - pageY;

    let newX = startBox.x;
    let newY = startBox.y;
    let newW = startBox.w;
    let newH = startBox.h;

    const MIN_SIZE = 60;

    if (handle === 'center') {
      newX = Math.max(0, Math.min(displayWidth - startBox.w, startBox.x + dx));
      newY = Math.max(0, Math.min(displayHeight - startBox.h, startBox.y + dy));
    } else if (handle === 'top') {
      const targetY = Math.max(0, Math.min(startBox.y + startBox.h - MIN_SIZE, startBox.y + dy));
      newY = targetY;
      newH = startBox.h - (targetY - startBox.y);
    } else if (handle === 'bottom') {
      newH = Math.max(MIN_SIZE, Math.min(displayHeight - startBox.y, startBox.h + dy));
    } else if (handle === 'left') {
      const targetX = Math.max(0, Math.min(startBox.x + startBox.w - MIN_SIZE, startBox.x + dx));
      newX = targetX;
      newW = startBox.w - (targetX - startBox.x);
    } else if (handle === 'right') {
      newW = Math.max(MIN_SIZE, Math.min(displayWidth - startBox.x, startBox.w + dx));
    } else if (handle === 'corner-tl') {
      const targetX = Math.max(0, Math.min(startBox.x + startBox.w - MIN_SIZE, startBox.x + dx));
      const targetY = Math.max(0, Math.min(startBox.y + startBox.h - MIN_SIZE, startBox.y + dy));
      newX = targetX;
      newW = startBox.w - (targetX - startBox.x);
      newY = targetY;
      newH = startBox.h - (targetY - startBox.y);
    } else if (handle === 'corner-tr') {
      const targetY = Math.max(0, Math.min(startBox.y + startBox.h - MIN_SIZE, startBox.y + dy));
      newW = Math.max(MIN_SIZE, Math.min(displayWidth - startBox.x, startBox.w + dx));
      newY = targetY;
      newH = startBox.h - (targetY - startBox.y);
    } else if (handle === 'corner-bl') {
      const targetX = Math.max(0, Math.min(startBox.x + startBox.w - MIN_SIZE, startBox.x + dx));
      newX = targetX;
      newW = startBox.w - (targetX - startBox.x);
      newH = Math.max(MIN_SIZE, Math.min(displayHeight - startBox.y, startBox.h + dy));
    } else if (handle === 'corner-br') {
      newW = Math.max(MIN_SIZE, Math.min(displayWidth - startBox.x, startBox.w + dx));
      newH = Math.max(MIN_SIZE, Math.min(displayHeight - startBox.y, startBox.h + dy));
    }

    setBox({ x: newX, y: newY, w: newW, h: newH });
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  const requireKey = () => {
    if (!OPENROUTER_API_KEY) {
      Alert.alert('API Key Missing', 'Set EXPO_PUBLIC_OPENROUTER_API_KEY in your .env file.');
      return false;
    }
    return true;
  };

  // ── Image picking ─────────────────────────────────────────────────────────

  const pickImage = async (fromCamera: boolean) => {
    let result: ImagePicker.ImagePickerResult;
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.85, base64: true });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Photo library access is required.'); return; }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85, base64: true });
    }
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
      setImageFileName(asset.fileName ?? undefined);
      setOriginalWidth(asset.width);
      setOriginalHeight(asset.height);
      setStep('preview');

      // Automatically open the crop editor
      startCropping(asset.uri, asset.width, asset.height);
    }
  };

  // ── Analyze ───────────────────────────────────────────────────────────────

  const handleAnalyze = async (src = sourceLang, out = outputLang) => {
    if (!requireKey() || !imageBase64 || !imageUri) return;
    setErrorMsg(null);
    setProgress(null);
    setStep('analyzing');
    try {
      const result = await parseRecipeFromImage(
        imageBase64,
        imageUri,
        OPENROUTER_API_KEY,
        {
          sourceLanguage: src ? langName(src) : undefined,
          outputLanguage: out ? langName(out) : undefined,
        },
        imageFileName,
        (update) => setProgress(update),
      );
      setParsed(result);
      setUsedModel(result.usedModel);
      setStep('done');
    } catch (e: any) {
      const msg: string = e?.message ?? 'Unknown error';
      console.error('[AI]', msg);
      setErrorMsg(msg);
      setStep('preview');
    }
  };

  const handleReset = () => {
    setStep('pick');
    setImageUri(null); setImageBase64(null); setImageFileName(undefined);
    setSourceLang(''); setOutputLang(''); setParsed(null);
    setUsedModel(null); setProgress(null); setErrorMsg(null);
    setOriginalWidth(0); setOriginalHeight(0);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const styles = makeStyles(theme);

  if (step === 'analyzing') {
    const current = progress;
    const switchBadge = current?.switchReason === 'timeout'
      ? '⏱ Timed out — switching model'
      : current?.switchReason === 'error'
      ? '⚠ Error — switching model'
      : null;

    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.statusMsg}>Analyzing recipe…</Text>

        {switchBadge && (
          <View style={styles.switchBadge}>
            <Text style={styles.switchBadgeText}>{switchBadge}</Text>
          </View>
        )}

        {current ? (
          <>
            <Text style={styles.statusHint}>
              🤖 {current.model.label}
              {current.model.hasReasoning ? '  ✦ reasoning' : ''}
            </Text>
            <Text style={styles.statusModel}>
              {current.model.id}
            </Text>
            <Text style={styles.statusAttempt}>
              Model {current.attempt} of {current.total}
            </Text>
          </>
        ) : (
          <Text style={styles.statusHint}>Starting…</Text>
        )}
      </View>
    );
  }

  if (step === 'pick') {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Scan a Recipe</Text>
        <Text style={styles.subtitle}>
          Take a photo or upload a recipe page.{'\n'}
          Gemini reads handwriting, Hebrew, and any language directly.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => pickImage(true)}>
          <Text style={styles.btnIcon}>📷</Text>
          <Text style={styles.primaryBtnText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage(false)}>
          <Text style={styles.btnIcon}>🖼</Text>
          <Text style={styles.secondaryBtnText}>Choose from Library</Text>
        </TouchableOpacity>
        {!OPENROUTER_API_KEY && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠ EXPO_PUBLIC_OPENROUTER_API_KEY is not set.{'\n'}Add it to your .env file.
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (step === 'preview') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.previewScroll}>
        {imageUri && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
            <TouchableOpacity
              style={styles.cropFloatingBtn}
              onPress={handleOpenCrop}
            >
              <Text style={styles.cropFloatingBtnText}>✂️ Crop Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {errorMsg && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerTitle}>Analysis failed</Text>
            <Text style={styles.errorBannerMsg}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.langCard}>

          <Text style={styles.langCardLabel}>Recipe is written in</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}>
            {QUICK_SOURCE.map((l) => {
              const active = sourceLang === l.code;
              return (
                <TouchableOpacity key={l.code}
                  style={[styles.quickChip, active && styles.quickChipActive]}
                  onPress={() => setSourceLang(l.code)}>
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                    {l.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.quickChip} onPress={() => setShowSrcPicker(true)}>
              <Text style={styles.quickChipText}>More ▾</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.langDivider} />

          <Text style={styles.langCardLabel}>Output language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}>
            {QUICK_OUTPUT.map((l) => {
              const active = outputLang === l.code;
              return (
                <TouchableOpacity key={l.code}
                  style={[styles.quickChip, active && styles.quickChipActive]}
                  onPress={() => setOutputLang(l.code)}>
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                    {l.label}
                  </Text>
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

        {/* ── Custom Crop Modal ───────────────────────────────────────────── */}
        <Modal visible={showCropModal} animationType="fade" transparent={false} onRequestClose={() => setShowCropModal(false)}>
          <SafeAreaView style={cropStyles.container}>
            <View style={cropStyles.header}>
              <TouchableOpacity style={cropStyles.headerBtn} onPress={() => setShowCropModal(false)}>
                <Text style={cropStyles.headerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={cropStyles.title}>Crop Recipe</Text>
              {isCropping ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 16 }} />
              ) : (
                <TouchableOpacity style={cropStyles.headerBtn} onPress={applyCrop}>
                  <Text style={[cropStyles.headerBtnText, { color: theme.primary }]}>Done</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={cropStyles.content}>
              {imageUri && (
                <View
                  style={{ width: displayWidth, height: displayHeight, position: 'relative', overflow: 'hidden', backgroundColor: '#000' }}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <Image source={{ uri: imageUri }} style={{ width: displayWidth, height: displayHeight, position: 'absolute' }} resizeMode="contain" />

                  {/* Backdrop overlays (cutout effect) */}
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: box.y, backgroundColor: 'rgba(0,0,0,0.65)' }} />
                  <View style={{ position: 'absolute', top: box.y + box.h, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)' }} />
                  <View style={{ position: 'absolute', top: box.y, left: 0, width: box.x, height: box.h, backgroundColor: 'rgba(0,0,0,0.65)' }} />
                  <View style={{ position: 'absolute', top: box.y, left: box.x + box.w, right: 0, height: box.h, backgroundColor: 'rgba(0,0,0,0.65)' }} />

                  {/* Crop Window Border */}
                  <View style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderColor: theme.primary, borderWidth: 2 }}>
                    <View style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                    <View style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                    <View style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                    <View style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                  </View>

                  {/* Center drag area */}
                  <View
                    style={{ position: 'absolute', left: box.x + 20, top: box.y + 20, width: Math.max(0, box.w - 40), height: Math.max(0, box.h - 40), zIndex: 8 }}
                    onTouchStart={(e) => handleTouchStart('center', e)}
                  />

                  {/* Edge drag bars */}
                  <View style={{ position: 'absolute', left: box.x + 20, top: box.y - 15, width: Math.max(0, box.w - 40), height: 30, zIndex: 9 }}
                    onTouchStart={(e) => handleTouchStart('top', e)} />
                  <View style={{ position: 'absolute', left: box.x + 20, top: box.y + box.h - 15, width: Math.max(0, box.w - 40), height: 30, zIndex: 9 }}
                    onTouchStart={(e) => handleTouchStart('bottom', e)} />
                  <View style={{ position: 'absolute', left: box.x - 15, top: box.y + 20, width: 30, height: Math.max(0, box.h - 40), zIndex: 9 }}
                    onTouchStart={(e) => handleTouchStart('left', e)} />
                  <View style={{ position: 'absolute', left: box.x + box.w - 15, top: box.y + 20, width: 30, height: Math.max(0, box.h - 40), zIndex: 9 }}
                    onTouchStart={(e) => handleTouchStart('right', e)} />

                  {/* Corner handles */}
                  <View style={{ position: 'absolute', left: box.x - 20, top: box.y - 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
                    onTouchStart={(e) => handleTouchStart('corner-tl', e)}>
                    <View style={[cropStyles.cornerVisual, { borderTopWidth: 3, borderLeftWidth: 3, borderColor: theme.primary, top: 10, left: 10 }]} />
                  </View>
                  <View style={{ position: 'absolute', left: box.x + box.w - 20, top: box.y - 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
                    onTouchStart={(e) => handleTouchStart('corner-tr', e)}>
                    <View style={[cropStyles.cornerVisual, { borderTopWidth: 3, borderRightWidth: 3, borderColor: theme.primary, top: 10, right: 10 }]} />
                  </View>
                  <View style={{ position: 'absolute', left: box.x - 20, top: box.y + box.h - 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
                    onTouchStart={(e) => handleTouchStart('corner-bl', e)}>
                    <View style={[cropStyles.cornerVisual, { borderBottomWidth: 3, borderLeftWidth: 3, borderColor: theme.primary, bottom: 10, left: 10 }]} />
                  </View>
                  <View style={{ position: 'absolute', left: box.x + box.w - 20, top: box.y + box.h - 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
                    onTouchStart={(e) => handleTouchStart('corner-br', e)}>
                    <View style={[cropStyles.cornerVisual, { borderBottomWidth: 3, borderRightWidth: 3, borderColor: theme.primary, bottom: 10, right: 10 }]} />
                  </View>
                </View>
              )}
            </View>

            <View style={cropStyles.footer}>
              <Text style={cropStyles.subtitle}>
                Drag the corners or the box edges to crop out background noise.{'\n'}
                Cropping to only the recipe text improves AI recognition.
              </Text>
              <TouchableOpacity style={cropStyles.resetBtn} onPress={resetCropBox}>
                <Text style={cropStyles.resetBtnText}>Reset to Full Image</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </ScrollView>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────

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
              <Text style={styles.aiBadgeText}>
                🤖 {usedModel?.label ?? 'AI'}
                {usedModel?.hasReasoning ? '  ✦' : ''}
              </Text>
            </View>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{parsed.category}</Text>
          </View>
          {outputLang ? (
            <Text style={styles.outputLangNote}>📝 Output language: {langName(outputLang)}</Text>
          ) : null}
          <Text style={styles.summaryLine}>
            {parsed.ingredients.length} ingredient{parsed.ingredients.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.summaryLine}>
            {parsed.steps.length} step{parsed.steps.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <View style={styles.reanalyzCard}>
        <Text style={styles.reanalyzLabel}>Change output language</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}>
          {QUICK_OUTPUT.map((l) => {
            const active = outputLang === l.code;
            return (
              <TouchableOpacity key={l.code}
                style={[styles.quickChip, active && styles.quickChipActive]}
                onPress={() => { setOutputLang(l.code); handleAnalyze(sourceLang, l.code); }}>
                <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.quickChip} onPress={() => setShowOutPicker(true)}>
            <Text style={styles.quickChipText}>More ▾</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => navigation.navigate('AddEditRecipe', { prefill: parsed ?? undefined })}
      >
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

// ── Crop modal styles (intentionally always dark — camera-like UI) ─────────────

const cropStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFF',
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  headerBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#AAA',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  footer: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  resetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CCC',
  },
  cornerVisual: {
    position: 'absolute',
    width: 16,
    height: 16,
  },
});

// ── Main screen styles (themed) ────────────────────────────────────────────────

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: theme.background },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
    statusMsg:    { marginTop: 16, fontSize: 16, color: theme.text, fontWeight: '600' },
    statusHint:   { marginTop: 6, fontSize: 13, color: theme.textSecondary },
    statusModel:   { marginTop: 4, fontSize: 11, color: theme.textSecondary, opacity: 0.6 },
    statusAttempt: { marginTop: 8, fontSize: 12, color: theme.textSecondary, fontWeight: '600' },
    switchBadge:   {
      marginTop: 14, marginBottom: 2,
      backgroundColor: '#FFF3CD', borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 5,
      borderWidth: 1, borderColor: '#FFD700',
    },
    switchBadgeText: { fontSize: 12, color: '#7A5800', fontWeight: '600' },
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
    btnIcon: { fontSize: 20, marginRight: 10 },
    ghostBtn: { paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 12 },
    ghostBtnText: { fontSize: 15, color: theme.textSecondary, fontWeight: '500' },
    flex1: { flex: 1, marginHorizontal: 8 },

    preview:      { width: '100%', height: 260, backgroundColor: '#000' },
    previewSmall: { width: '100%', height: 180, backgroundColor: '#000', borderRadius: 12, marginBottom: 16 },
    actionRow:    { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 },

    errorBanner: {
      backgroundColor: theme.errorBox, borderRadius: 10, padding: 14,
      marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: theme.errorText,
    },
    errorBannerTitle: { fontSize: 14, fontWeight: '700', color: theme.errorText, marginBottom: 4 },
    errorBannerMsg:   { fontSize: 13, color: theme.errorText, lineHeight: 18 },

    warningBox: {
      backgroundColor: theme.warningBox, borderRadius: 10, padding: 14,
      marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderColor: theme.border,
    },
    warningText: { fontSize: 13, color: theme.warningText, lineHeight: 20 },

    langCard: {
      backgroundColor: theme.card, margin: 16, borderRadius: 14,
      padding: 16, borderWidth: 1, borderColor: theme.border,
    },
    langCardLabel: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
    langDivider:  { height: 1, backgroundColor: theme.border, marginVertical: 14 },
    quickRow:     { flexDirection: 'row', gap: 8, paddingBottom: 2 },
    quickChip: {
      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
      backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border,
    },
    quickChipActive:     { backgroundColor: theme.primaryLight, borderColor: theme.primary },
    quickChipText:       { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
    quickChipTextActive: { color: theme.primary },

    summaryCard: {
      backgroundColor: theme.card, borderRadius: 14, padding: 16, marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    summaryTitleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    summaryTitle:    { fontSize: 19, fontWeight: '700', color: theme.text },
    aiBadge:         { backgroundColor: '#EDE7F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8, marginTop: 2 },
    aiBadgeText:     { fontSize: 11, fontWeight: '600', color: '#6A1B9A' },
    pill:            { alignSelf: 'flex-start', backgroundColor: theme.primaryLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
    pillText:        { fontSize: 12, color: theme.primary, fontWeight: '500' },
    outputLangNote:  { fontSize: 13, color: theme.textSecondary, marginBottom: 6 },
    summaryLine:     { fontSize: 14, color: theme.textSecondary, marginTop: 4 },

    reanalyzCard: {
      backgroundColor: theme.card, borderRadius: 14, padding: 16, marginBottom: 16,
      borderWidth: 1, borderColor: theme.border,
    },
    reanalyzLabel: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },

    previewContainer: {
      position: 'relative',
      width: '100%',
      height: 260,
      backgroundColor: '#000',
    },
    cropFloatingBtn: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    cropFloatingBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFF',
    },
  });
}
