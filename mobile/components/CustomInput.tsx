import { TextInput, StyleSheet } from 'react-native';

export default function CustomInput(props: any) {
  return (
    <TextInput
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
});
