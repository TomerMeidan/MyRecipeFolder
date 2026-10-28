import { useState, useRef, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Alert, ActivityIndicator, Modal, PanResponder,
  Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { parseRecipeFromImages, RecipeImage } from '../utils/aiParser';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const MAX_IMAGES = 10;

type Step = 'pick' | 'preview' | 'analyzing';

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
          <TouchableOpacity onPress={onClose} style={pickerStyles.close} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => {
            const active = item.code === selected;
            return (
              <TouchableOpacity
                style={[pickerStyles.row, { borderBottomColor: theme.border }, active && { backgroundColor: theme.highlight }]}
                onPress={() => { onSelect(item.code); onClose(); }}
              >
                <Text style={[pickerStyles.rowLabel, { color: theme.text }, active && { fontWeight: '800' }]}>
                  {item.label}
                </Text>
                {item.native ? <Text style={[pickerStyles.rowNative, { color: theme.textSecondary }]}>{item.native}</Text> : null}
                {active && <Ionicons name="checkmark" size={22} color={theme.text} />}
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
  title:   { fontSize: 20, fontWeight: '800' },
  close:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row:     { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 16, borderBottomWidth: 1 },
  rowLabel:  { fontSize: 17, flex: 1 },
  rowNative: { fontSize: 16, marginEnd: 10 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ScanRecipeScreen() {
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();

  const [step, setStep]               = useState<Step>('pick');
  const [images, setImages]           = useState<RecipeImage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sourceLang, setSourceLang]   = useState('');
  const [outputLang, setOutputLang]   = useState('');
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [showSrcPicker, setShowSrcPicker] = useState(false);
  const [showOutPicker, setShowOutPicker] = useState(false);

  // ── Crop state ───────────────────────────────────────────────────────────────
  const [showCrop, setShowCrop]             = useState(false);
  const [cropImgSize, setCropImgSize]       = useState({ w: 1, h: 1 });
  const [cropBox, setCropBox]               = useState({ x: 0, y: 0, w: 0, h: 0 });
  const cropBoxRef                          = useRef({ x: 0, y: 0, w: 0, h: 0 });
  // containerRef holds display dimensions — stored in a ref so PanResponder
  // closures always read the current value (refs never go stale in closures).
  const containerRef                        = useRef({ w: 1, h: 1 });
  const cropImgSizeRef                      = useRef({ w: 1, h: 1 });
  const [isCropApplying, setIsCropApplying] = useState(false);

  function computeContainer(iw: number, ih: number) {
    const sw   = Dimensions.get('window').width;
    const maxW = sw - 32;
    const maxH = Dimensions.get('window').height * 0.6;
    const ratio = ih / iw;
    let w = maxW, h = w * ratio;
    if (h > maxH) { h = maxH; w = h / ratio; }
    return { w: Math.round(w), h: Math.round(h) };
  }

  // PanResponders are created once (useRef). They read from refs so they
  // always get the current container / cropBox values.
  const makePanResponder = (handle: string) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      cropBoxRef.current = { ...cropBox };
    },
    onPanResponderMove: (_e, gs) => {
      const start       = cropBoxRef.current;
      const { w: CW, h: CH } = containerRef.current;
      const MIN = 60;
      let { x, y, w, h } = start;
      if (handle === 'center') {
        x = Math.max(0, Math.min(CW - w, start.x + gs.dx));
        y = Math.max(0, Math.min(CH - h, start.y + gs.dy));
      } else {
        if (handle === 'tl' || handle === 'bl') {
          const nx = Math.max(0, Math.min(start.x + start.w - MIN, start.x + gs.dx));
          w = start.w - (nx - start.x); x = nx;
        }
        if (handle === 'tr' || handle === 'br') {
          w = Math.max(MIN, Math.min(CW - start.x, start.w + gs.dx));
        }
        if (handle === 'tl' || handle === 'tr') {
          const ny = Math.max(0, Math.min(start.y + start.h - MIN, start.y + gs.dy));
          h = start.h - (ny - start.y); y = ny;
        }
        if (handle === 'bl' || handle === 'br') {
          h = Math.max(MIN, Math.min(CH - start.y, start.h + gs.dy));
        }
      }
      const next = { x, y, w, h };
      cropBoxRef.current = next;
      setCropBox(next);
    },
  });

  const panCenter = useRef(makePanResponder('center')).current;
  const panTL     = useRef(makePanResponder('tl')).current;
  const panTR     = useRef(makePanResponder('tr')).current;
  const panBL     = useRef(makePanResponder('bl')).current;
  const panBR     = useRef(makePanResponder('br')).current;

  const activeImage = images[activeIndex] ?? null;

  const openCrop = () => {
    if (!activeImage) return;
    Image.getSize(activeImage.uri, (iw, ih) => {
      // Compute container BEFORE setting state so box init uses correct dims
      const c = computeContainer(iw, ih);
      containerRef.current   = c;
      cropImgSizeRef.current = { w: iw, h: ih };
      setCropImgSize({ w: iw, h: ih });
      const box = { x: c.w * 0.05, y: c.h * 0.05, w: c.w * 0.9, h: c.h * 0.9 };
      setCropBox(box);
      cropBoxRef.current = box;
      setShowCrop(true);
    }, () => {
      // Fallback if getSize fails — use screen width as square
      const sw = Dimensions.get('window').width - 32;
      const c  = { w: sw, h: sw };
      containerRef.current = c;
      const box = { x: c.w * 0.05, y: c.h * 0.05, w: c.w * 0.9, h: c.h * 0.9 };
      setCropBox(box); cropBoxRef.current = box;
      setShowCrop(true);
    });
  };

  const CROP_CONTAINER = containerRef.current;   // for rendering only

  const applyCrop = async () => {
    if (!activeImage) return;
    setIsCropApplying(true);
    const { w: CW, h: CH } = containerRef.current;
    const { w: IW, h: IH } = cropImgSizeRef.current;
    const sx = IW / CW;
    const sy = IH / CH;
    const originX  = Math.max(0, Math.round(cropBox.x * sx));
    const originY  = Math.max(0, Math.round(cropBox.y * sy));
    const cropW    = Math.max(10, Math.min(IW - originX, Math.round(cropBox.w * sx)));
    const cropH    = Math.max(10, Math.min(IH - originY, Math.round(cropBox.h * sy)));
    const maxDim   = 1024;
    const scale    = Math.min(1, maxDim / Math.max(cropW, cropH));
    try {
      const result = await ImageManipulator.manipulateAsync(
        activeImage.uri,
        [
          { crop: { originX, originY, width: cropW, height: cropH } },
          ...(scale < 1 ? [{ resize: { width: Math.round(cropW * scale) } }] : []),
        ],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      setImages((prev) => prev.map((img, i) =>
        i === activeIndex ? { ...img, uri: result.uri, base64: result.base64 ?? img.base64 } : img,
      ));
      setShowCrop(false);
    } catch (e: any) {
      Alert.alert('Crop failed', e?.message ?? 'Could not crop.');
    } finally {
      setIsCropApplying(false);
    }
  };

  // ── Image picking (allowsEditing = native crop UI built into the picker) ──────

  const pickImage = async (fromCamera: boolean) => {
    if (images.length >= MAX_IMAGES) return;

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
      setImages((prev) => {
        const next = [...prev, {
          uri: compressed.uri,
          base64: compressed.base64 ?? '',
          fileName: asset.fileName ?? undefined,
        }];
        setActiveIndex(next.length - 1);
        return next;
      });
      setStep('preview');
    }
  };

  const handleAddMore = () => {
    if (Platform.OS === 'web') { pickImage(false); return; }
    Alert.alert('Add Photo', undefined, [
      { text: 'Take Photo', onPress: () => pickImage(true) },
      { text: 'Choose from Library', onPress: () => pickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setStep('pick');
        setActiveIndex(0);
      } else {
        setActiveIndex((cur) => Math.min(cur, next.length - 1));
      }
      return next;
    });
  };

  // ── Analyze ───────────────────────────────────────────────────────────────────

  const handleAnalyze = async (src = sourceLang, out = outputLang) => {
    if (images.length === 0) return;
    setErrorMsg(null);
    setStep('analyzing');
    try {
      const result = await parseRecipeFromImages(
        images,
        {
          sourceLanguage: src ? langName(src) : undefined,
          outputLanguage: out ? langName(out) : undefined,
        },
      );
      setStep('preview');
      navigation.navigate('AddEditRecipe', { prefill: result });
    } catch (e: any) {
      const msg: string = e?.message ?? 'Unknown error';
      console.error('[Gemini]', msg);
      setErrorMsg(msg);
      setStep('preview');
    }
  };

  const handleReset = () => {
    setStep('pick');
    setImages([]); setActiveIndex(0);
    setSourceLang(''); setOutputLang(''); setErrorMsg(null);
  };

  const styles = makeStyles(theme);

  // ── Analyzing ─────────────────────────────────────────────────────────────────

  if (step === 'analyzing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.statusMsg}>Analyzing recipe…</Text>
        <Text style={styles.statusHint}>Gemini 3.8 Flash</Text>
        <Text style={styles.statusModel}>gemini-3.8-flash</Text>
      </View>
    );
  }

  // ── Pick ──────────────────────────────────────────────────────────────────────

  if (step === 'pick') {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Scan a Recipe</Text>
        <Text style={styles.subtitle}>
          Take a photo or upload a recipe page — add up to {MAX_IMAGES} photos{'\n'}
          (e.g. multiple pages). You can crop each one in the next step.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => pickImage(true)} accessibilityRole="button">
          <Ionicons name="camera-outline" size={24} color={theme.onPrimary} />
          <Text style={styles.primaryBtnText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage(false)} accessibilityRole="button">
          <Ionicons name="images-outline" size={24} color={theme.text} />
          <Text style={styles.secondaryBtnText}>Choose from Library</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────────

  if (step === 'preview') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.previewScroll}>
        {activeImage && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: activeImage.uri }} style={styles.preview} resizeMode="contain" />
            <TouchableOpacity style={styles.cropBtn} onPress={openCrop} accessibilityRole="button">
              <Ionicons name="crop" size={20} color={theme.onPrimary} />
              <Text style={styles.cropBtnText}>Crop Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Thumbnail strip — select, remove, or add up to MAX_IMAGES photos */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbStrip}>
          {images.map((img, i) => (
            <TouchableOpacity
              key={img.uri}
              style={[styles.thumbWrap, i === activeIndex && styles.thumbWrapActive]}
              onPress={() => setActiveIndex(i)}
            >
              <Image source={{ uri: img.uri }} style={styles.thumb} resizeMode="cover" />
              <TouchableOpacity
                style={styles.thumbRemove}
                onPress={() => removeImage(i)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
              >
                <Ionicons name="close" size={18} color={theme.background} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
          {images.length < MAX_IMAGES && (
            <TouchableOpacity style={styles.thumbAdd} onPress={handleAddMore} accessibilityRole="button" accessibilityLabel="Add another photo">
              <Ionicons name="add" size={26} color={theme.text} />
              <Text style={styles.thumbAddLabel}>{images.length}/{MAX_IMAGES}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

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
            <TouchableOpacity style={styles.quickChip} onPress={() => setShowSrcPicker(true)} accessibilityRole="button" accessibilityLabel="More recipe languages">
              <Text style={styles.quickChipText}>More</Text>
              <Ionicons name="chevron-down" size={16} color={theme.text} />
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
            <TouchableOpacity style={styles.quickChip} onPress={() => setShowOutPicker(true)} accessibilityRole="button" accessibilityLabel="More output languages">
              <Text style={styles.quickChipText}>More</Text>
              <Ionicons name="chevron-down" size={16} color={theme.text} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.ghostBtn} onPress={handleReset} accessibilityRole="button">
            <Text style={styles.ghostBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, styles.flex1]} onPress={() => handleAnalyze()} accessibilityRole="button">
            <Ionicons name="sparkles-outline" size={22} color={theme.onPrimary} />
            <Text style={styles.primaryBtnText}>Analyze Recipe</Text>
          </TouchableOpacity>
        </View>

        <LangPickerModal visible={showSrcPicker} selected={sourceLang} includeAuto
          title="Recipe language" onSelect={setSourceLang} onClose={() => setShowSrcPicker(false)} />
        <LangPickerModal visible={showOutPicker} selected={outputLang}
          title="Output language" onSelect={setOutputLang} onClose={() => setShowOutPicker(false)} />

        <CropModal
          visible={showCrop} imageUri={activeImage?.uri ?? null}
          panTL={panTL} panTR={panTR} panBL={panBL} panBR={panBR} panCenter={panCenter}
          cropBox={cropBox} container={CROP_CONTAINER}
          isCropApplying={isCropApplying}
          onApply={applyCrop} onCancel={() => setShowCrop(false)}
          theme={theme}
        />
      </ScrollView>
    );
  }

}

// ── Crop modal (native only) ──────────────────────────────────────────────────

function CropModal({ visible, imageUri, panTL, panTR, panBL, panBR, panCenter, cropBox, container, isCropApplying, onApply, onCancel, theme }: {
  visible: boolean; imageUri: string | null;
  panTL: any; panTR: any; panBL: any; panBR: any; panCenter: any;
  cropBox: { x: number; y: number; w: number; h: number };
  container: { w: number; h: number };
  isCropApplying: boolean;
  onApply: () => void; onCancel: () => void;
  theme: ThemeColors;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onCancel}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <TouchableOpacity onPress={onCancel} style={{ minHeight: 48, minWidth: 64, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 17, fontWeight: '700' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Crop Photo</Text>
          {isCropApplying
            ? <ActivityIndicator color={theme.primary} />
            : <TouchableOpacity onPress={onApply} style={{ minHeight: 48, minWidth: 64, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 8 }}>
                <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>Done</Text>
              </TouchableOpacity>
          }
        </View>

        {/* Image + crop overlay */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {imageUri && (
            <View style={{ width: container.w, height: container.h, position: 'relative' }}>
              <Image source={{ uri: imageUri }} style={{ width: container.w, height: container.h }} resizeMode="contain" />

              {/* Dark overlay cutouts */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: cropBox.y, backgroundColor: 'rgba(0,0,0,0.6)' }} />
              <View style={{ position: 'absolute', top: cropBox.y + cropBox.h, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
              <View style={{ position: 'absolute', top: cropBox.y, left: 0, width: cropBox.x, height: cropBox.h, backgroundColor: 'rgba(0,0,0,0.6)' }} />
              <View style={{ position: 'absolute', top: cropBox.y, left: cropBox.x + cropBox.w, right: 0, height: cropBox.h, backgroundColor: 'rgba(0,0,0,0.6)' }} />

              {/* Crop border */}
              <View style={{ position: 'absolute', left: cropBox.x, top: cropBox.y, width: cropBox.w, height: cropBox.h, borderWidth: 2, borderColor: theme.primary }} />

              {/* Centre drag */}
              <View {...panCenter.panHandlers} style={{ position: 'absolute', left: cropBox.x + 30, top: cropBox.y + 30, width: Math.max(0, cropBox.w - 60), height: Math.max(0, cropBox.h - 60) }} />

              {/* Corner handles — 44×44 touch targets */}
              {([['tl', panTL, cropBox.x - 22, cropBox.y - 22],
                 ['tr', panTR, cropBox.x + cropBox.w - 22, cropBox.y - 22],
                 ['bl', panBL, cropBox.x - 22, cropBox.y + cropBox.h - 22],
                 ['br', panBR, cropBox.x + cropBox.w - 22, cropBox.y + cropBox.h - 22],
              ] as [string, any, number, number][]).map(([key, pan, left, top]) => (
                <View key={key} {...pan.panHandlers}
                  style={{ position: 'absolute', left, top, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{
                    width: 20, height: 20, borderColor: theme.primary,
                    borderTopWidth: key.includes('t') ? 3 : 0,
                    borderBottomWidth: key.includes('b') ? 3 : 0,
                    borderLeftWidth: key.includes('l') ? 3 : 0,
                    borderRightWidth: key.includes('r') ? 3 : 0,
                  }} />
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 15, paddingBottom: 20 }}>
          Drag corners to resize • Drag centre to move
        </Text>
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: theme.background },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
    statusMsg:    { marginTop: 16, fontSize: 20, color: theme.text, fontWeight: '800' },
    statusHint:   { marginTop: 6, fontSize: 15, color: theme.textSecondary },
    statusModel:  { marginTop: 4, fontSize: 13, color: theme.textSecondary },
    previewScroll: { paddingBottom: 32 },

    heading:  { fontSize: 30, fontWeight: '800', color: theme.text, marginTop: 32, marginBottom: 10, marginHorizontal: 16 },
    subtitle: { fontSize: 17, color: theme.textSecondary, lineHeight: 25, marginHorizontal: 16, marginBottom: 32 },

    primaryBtn: {
      backgroundColor: theme.primary, borderRadius: 12, minHeight: 56, gap: 10,
      alignItems: 'center', marginHorizontal: 16, marginBottom: 12,
      flexDirection: 'row', justifyContent: 'center',
    },
    primaryBtnText: { fontSize: 18, fontWeight: '800', color: theme.onPrimary },
    secondaryBtn: {
      borderRadius: 12, minHeight: 56, gap: 10,
      alignItems: 'center', marginHorizontal: 16, marginBottom: 12,
      borderWidth: 1.5, borderColor: theme.borderStrong, flexDirection: 'row', justifyContent: 'center',
    },
    secondaryBtnText: { fontSize: 18, fontWeight: '700', color: theme.text },
    ghostBtn:  { minHeight: 52, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
    ghostBtnText: { fontSize: 17, color: theme.text, fontWeight: '700' },
    flex1:     { flex: 1, marginHorizontal: 0, marginBottom: 0 },

    // Photo letterbox stays black in both themes so scans keep true contrast.
    previewContainer: { width: '100%', height: 300, backgroundColor: '#000', position: 'relative' },
    preview:      { width: '100%', height: 300, backgroundColor: '#000' },
    previewSmall: { width: '100%', height: 180, backgroundColor: '#000', borderRadius: 12, marginBottom: 16 },
    actionRow:    { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },

    cropBtn: {
      position: 'absolute', bottom: 14, end: 14,
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: theme.primary, borderRadius: 24,
      minHeight: 48, paddingHorizontal: 18,
    },
    cropBtnText: { color: theme.onPrimary, fontSize: 16, fontWeight: '800' },

    thumbStrip: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
    thumbWrap: {
      width: 68, height: 68, borderRadius: 10, overflow: 'hidden',
      borderWidth: 2, borderColor: theme.border, position: 'relative',
    },
    thumbWrapActive: { borderColor: theme.text, borderWidth: 3 },
    thumb: { width: '100%', height: '100%' },
    thumbRemove: {
      position: 'absolute', top: 3, end: 3, width: 26, height: 26, borderRadius: 13,
      backgroundColor: theme.text, alignItems: 'center', justifyContent: 'center',
    },
    thumbAdd: {
      width: 68, height: 68, borderRadius: 10, borderWidth: 1.5, borderColor: theme.borderStrong,
      borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    },
    thumbAddLabel: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, fontVariant: ['tabular-nums'] },

    errorBanner:      { backgroundColor: theme.errorBox, borderRadius: 10, padding: 14, marginHorizontal: 16, marginTop: 12, borderWidth: 1.5, borderColor: theme.errorText },
    errorBannerTitle: { fontSize: 17, fontWeight: '800', color: theme.errorText, marginBottom: 4 },
    errorBannerMsg:   { fontSize: 15, color: theme.errorText, lineHeight: 21 },


    langCard:      { marginHorizontal: 16, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border },
    langCardLabel: { fontSize: 17, fontWeight: '800', color: theme.text, marginBottom: 10 },
    langDivider:   { height: 16 },
    quickRow:      { flexDirection: 'row', gap: 8, paddingBottom: 2 },
    quickChip:          { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, borderWidth: 1.5, borderColor: theme.borderStrong },
    quickChipActive:    { backgroundColor: theme.text, borderColor: theme.text },
    quickChipText:      { fontSize: 15, color: theme.text, fontWeight: '700' },
    quickChipTextActive: { color: theme.background },

  });
}
