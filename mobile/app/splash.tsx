import { View, Text, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => {
      router.replace('/');
    }, 2000);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>College Photo Gallery</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
