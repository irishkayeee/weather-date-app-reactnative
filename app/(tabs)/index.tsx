import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const COLORS = {
  deepCrimson: '#4A0E17',
  darkBurgundy: '#2A080C',
  metallicGold: '#D4AF37',
  pureWhite: '#FFFFFF',
  mediumGray: '#A3A3A3',
  translucentWhite: 'rgba(255,255,255,0.07)',
  softWhiteBorder: 'rgba(255,255,255,0.12)',
  translucentBlack: 'rgba(0,0,0,0.2)',
};

const WEATHER_POLL_MS = 60 * 1000; 

function describeWeatherCode(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear Sky',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Freezing Fog',
    51: 'Light Drizzle',
    53: 'Drizzle',
    55: 'Dense Drizzle',
    61: 'Light Rain',
    63: 'Rain',
    65: 'Heavy Rain',
    71: 'Light Snow',
    73: 'Snow',
    75: 'Heavy Snow',
    80: 'Rain Showers',
    81: 'Rain Showers',
    82: 'Violent Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm w/ Hail',
    99: 'Severe Thunderstorm',
  };
  return map[code] ?? 'Unknown';
}

function weatherIconFor(code: number): keyof typeof Ionicons.glyphMap {
  if (code === 0 || code === 1) return 'sunny-outline';
  if (code === 2) return 'partly-sunny-outline';
  if (code === 3) return 'cloud-outline';
  if (code === 45 || code === 48) return 'cloud-outline';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'rainy-outline';
  if ([71, 73, 75].includes(code)) return 'snow-outline';
  if ([95, 96, 99].includes(code)) return 'thunderstorm-outline';
  return 'help-circle-outline';
}

type Coords = { latitude: number; longitude: number };

type WeatherData = {
  temperature: number;
  humidity: number;
  windSpeed: number;
  code: number;
};

export default function HomeScreen() {
  const [now, setNow] = useState(new Date());
  const [locationLabel, setLocationLabel] = useState<string>('Locating…');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const coordsRef = useRef<Coords | null>(null);
  coordsRef.current = coords;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let isMounted = true;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied');
        setLocationLabel('Location unavailable');
        setLoading(false);
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 15000, 
          distanceInterval: 50, 
        },
        (position) => {
          if (!isMounted) return;
          setCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      );
    };

    start();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);

useEffect(() => {
  if (!coords) return;

  const resolveLabel = async () => {
    try {
      const geoRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`
      );
      const geoJson = await geoRes.json();
      const city = geoJson.locality || geoJson.city || '';
      const country = geoJson.countryCode || '';

      const adminNames: string[] = (geoJson.localityInfo?.administrative || [])
        .map((a: { name?: string }) => a.name)
        .filter((name: string | undefined): name is string => !!name);

      const province =
        adminNames
          .filter(
            (name) =>
              !/region/i.test(name) &&
              name !== geoJson.countryName &&
              name !== city
          )
          .pop() || geoJson.principalSubdivision || '';

      const label = [city, province].filter(Boolean).join(' ');
      setLocationLabel(`${label}${country ? ', ' + country : ''}`.toUpperCase());
    } catch {
      setLocationLabel(`${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}`);
    }
  };

  resolveLabel();
}, [coords?.latitude, coords?.longitude]);

  const fetchWeather = async (target: Coords) => {
    try {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${target.latitude}&longitude=${target.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`
      );
      const weatherJson = await weatherRes.json();
      const current = weatherJson.current;

      setWeather({
        temperature: Math.round(current.temperature_2m),
        humidity: Math.round(current.relative_humidity_2m),
        windSpeed: Math.round(current.wind_speed_10m),
        code: current.weather_code,
      });
      setErrorMsg(null);
    } catch {
      setErrorMsg('Failed to load weather');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (coords) fetchWeather(coords);
  }, [coords?.latitude, coords?.longitude]);

  useEffect(() => {
    const id = setInterval(() => {
      if (coordsRef.current) fetchWeather(coordsRef.current);
    }, WEATHER_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <LinearGradient colors={[COLORS.deepCrimson, COLORS.darkBurgundy]} style={styles.flex}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Location pill */}
          <View style={styles.locationPill}>
            <Ionicons name="location" size={16} color={COLORS.metallicGold} />
            <Text style={styles.locationText}>{locationLabel}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="time-outline" size={18} color={COLORS.metallicGold} />
              <Text style={styles.cardLabel}>CURRENT TIME</Text>
            </View>
            <Text style={styles.timeText}>{timeString}</Text>
            <View style={styles.subRow}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.mediumGray} />
              <Text style={styles.dateText}>{dateString}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Ionicons
                name={weather ? weatherIconFor(weather.code) : 'help-circle-outline'}
                size={18}
                color={COLORS.metallicGold}
              />
              <Text style={styles.cardLabel}>WEATHER UPDATES</Text>
            </View>

            {loading ? (
              <ActivityIndicator color={COLORS.metallicGold} style={{ marginVertical: 24 }} />
            ) : errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : (
              <>
                <Text style={styles.tempText}>{weather?.temperature}°C</Text>
                <Text style={styles.conditionText}>
                  {weather ? describeWeatherCode(weather.code) : '—'}
                </Text>
                <View style={styles.statsBox}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>HUMIDITY</Text>
                    <Text style={styles.statValue}>{weather?.humidity}%</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>WIND</Text>
                    <Text style={styles.statValue}>{weather?.windSpeed} km/h</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Branding Card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="logo-react" size={18} color={COLORS.metallicGold} />
              <Text style={styles.cardLabel}>REACT NATIVE</Text>
            </View>
            <Text style={styles.brandText}>SIR MAGS</Text>
          </View>
        </ScrollView>

        <View style={styles.footerRow}>
          <Ionicons name="logo-react" size={14} color={COLORS.metallicGold} />
          <Text style={styles.footerText}>REACT NATIVE • LIVE MONITORS</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 20,
    alignItems: 'center',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.translucentWhite,
    borderColor: COLORS.softWhiteBorder,
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 28,
  },
  locationText: {
    color: COLORS.pureWhite,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.translucentWhite,
    borderColor: COLORS.softWhiteBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    marginBottom: 22,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardLabel: {
    color: COLORS.metallicGold,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  },
  timeText: {
    color: COLORS.pureWhite,
    fontSize: 44,
    fontWeight: '800',
    marginBottom: 12,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    color: COLORS.mediumGray,
    fontSize: 15,
  },
  tempText: {
    color: COLORS.pureWhite,
    fontSize: 52,
    fontWeight: '800',
  },
  conditionText: {
    color: COLORS.pureWhite,
    fontSize: 17,
    marginTop: 4,
    marginBottom: 18,
  },
  statsBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.translucentBlack,
    borderRadius: 14,
    paddingVertical: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.softWhiteBorder,
  },
  statLabel: {
    color: COLORS.mediumGray,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValue: {
    color: COLORS.pureWhite,
    fontSize: 18,
    fontWeight: '700',
  },
  brandText: {
    color: COLORS.pureWhite,
    fontSize: 38,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  errorText: {
    color: COLORS.mediumGray,
    fontSize: 14,
    marginVertical: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  footerText: {
    color: COLORS.pureWhite,
    fontSize: 11,
    letterSpacing: 1,
    opacity: 0.85,
  },
});