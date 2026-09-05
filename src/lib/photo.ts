import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/** Zwraca URI wybranego zdjęcia albo null (anulowano). */
export async function pickPhotoUri(
  fromCamera: boolean,
): Promise<string | null> {
  const res = fromCamera
    ? await ImagePicker.launchCameraAsync({
        quality: 0.6,
        exif: false,
      })
    : await ImagePicker.launchImageLibraryAsync({
        quality: 0.6,
        exif: false,
      });
  if (res.canceled || !res.assets[0]?.uri) return null;
  return res.assets[0].uri;
}

/** Pyta o źródło (aparat/galeria) i zwraca URI zdjęcia przez callback. */
export function choosePhoto(onPick: (uri: string) => void): void {
  Alert.alert('Zdjęcie', 'Wybierz źródło zdjęcia:', [
    { text: 'Anuluj', style: 'cancel' },
    {
      text: 'Aparat',
      onPress: () => {
        pickPhotoUri(true)
          .then((u) => {
            if (u) onPick(u);
          })
          .catch(() => {
            Alert.alert('Błąd', 'Nie udało się zrobić zdjęcia.');
          });
      },
    },
    {
      text: 'Galeria',
      onPress: () => {
        pickPhotoUri(false)
          .then((u) => {
            if (u) onPick(u);
          })
          .catch(() => {
            Alert.alert('Błąd', 'Nie udało się wybrać zdjęcia.');
          });
      },
    },
  ]);
}
