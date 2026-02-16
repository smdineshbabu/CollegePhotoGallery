import { Redirect, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import * as authService from "../services/authService";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
