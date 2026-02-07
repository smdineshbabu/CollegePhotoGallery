import { ActivityIndicator, View } from 'react-native';

export default function Loader() {
  return (
    <View style={{ marginTop: 10 }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
