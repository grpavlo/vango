# Mobile App — Google Maps Setup

This app uses `react-native-maps` with the Google provider on both Android and iOS.

Follow these steps to provide your Google Maps API keys.

## 1) Android

- Put your key into `mobile-app/android/app/src/main/res/values/strings.xml`:

```
<string name="google_maps_api_key">YOUR_ANDROID_KEY</string>
```

The Android manifest references this string via:

```
<meta-data android:name="com.google.android.geo.API_KEY" android:value="@string/google_maps_api_key"/>
```

## 2) iOS

- Open `mobile-app/ios/mobile/Info.plist` and set the `GMSApiKey` value:

```
<key>GMSApiKey</key>
<string>YOUR_IOS_KEY</string>
```

- Install pods after changing the key or updating dependencies:

```
cd mobile-app/ios && pod install
```

Note: We added the required pods in `ios/Podfile`:

```
pod 'GoogleMaps'
pod 'Google-Maps-iOS-Utils'
```

The iOS app initializes Google Maps in `ios/mobile/AppDelegate.swift` by reading `GMSApiKey` from the Info.plist.

## 3) App code

All maps now render with the Google provider. We removed OSM tiles and set `provider={PROVIDER_GOOGLE}` in:

- `src/screens/MapSelectScreen.js`
- `src/screens/AllOrdersScreen.js`
- `src/components/OrderCard.js`

No changes to address search were made (it still uses OpenStreetMap/Nominatim). If you want Google Places Autocomplete, we can add it on request.

