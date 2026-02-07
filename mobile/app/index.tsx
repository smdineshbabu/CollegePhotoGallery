import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import CustomButton from '../components/CustomButton';
import CustomInput from '../components/CustomInput';
// Loader is available if needed later
// import Loader from '../components/Loader';

export default function Login() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>College Photo Gallery</Text>

      <CustomInput
        placeholder="Email"
        keyboardType="email-address"
      />

      <CustomInput
        placeholder="Password"
        secureTextEntry
      />

      <CustomButton
        title="Login"
        onPress={() => router.replace('/(tabs)/home')}
      />

      {/* Loader can be used when API is added */}
      {/* <Loader /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 25,
    fontWeight: 'bold',
  },
});
