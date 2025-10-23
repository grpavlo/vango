import * as Localization from 'expo-localization';
import  {I18n} from 'i18n-js';
import en from './locales/en.json';
import {getLocales} from "expo-localization";


// Set the key-value pairs for the different languages you want to support.
const translations = {
    en

};
const i18n = new I18n(translations);

i18n.locale = getLocales()[0].languageCode ?? 'en';

// When a value is missing from a language it'll fall back to another language with the key present.
i18n.enableFallback = true;

export default i18n;
