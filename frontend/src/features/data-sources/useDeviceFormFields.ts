import { useState } from "react";
import type { DataSource, DataSourceTemplate } from "./dataSourceTypes";

/**
 * Owns the ~20 primitive form fields shared by every device add/edit form. Each caller
 * (an add-device flow, or the edit-device modal) gets its own independent instance, so
 * one flow's in-progress form never leaks into another's.
 */
export function useDeviceFormFields() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<DataSource["type"]>("json-api");
  const [url, setUrl] = useState("");
  const [healthStatusUrl, setHealthStatusUrl] = useState("");
  const [brokerUrl, setBrokerUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [gpioChip, setGpioChip] = useState("gpiochip0");
  const [gpioPin, setGpioPin] = useState("17");
  const [gpioProfile, setGpioProfile] = useState<"generic" | "pir-motion">("generic");
  const [gpioPull, setGpioPull] = useState<"off" | "up" | "down">("off");
  const [gpioEdge, setGpioEdge] = useState<"rising" | "falling" | "both">("both");
  const [gpioDebounceMs, setGpioDebounceMs] = useState("100");
  const [gpioActiveState, setGpioActiveState] = useState<"high" | "low">("high");
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [cameraWidth, setCameraWidth] = useState("1280");
  const [cameraHeight, setCameraHeight] = useState("720");
  const [cameraDurationMs, setCameraDurationMs] = useState("1000");
  const [cameraFps, setCameraFps] = useState("30");
  const [bmeSensor, setBmeSensor] = useState<"bme280" | "bme680">("bme280");
  const [bmeBus, setBmeBus] = useState("1");
  const [bmeAddress, setBmeAddress] = useState<"0x76" | "0x77">("0x76");
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "PATCH">("GET");

  function fillFields(
    nextName: string,
    nextDescription: string,
    nextType: DataSource["type"],
    config: DataSource["config"],
  ) {
    setName(nextName);
    setDescription(nextDescription);
    setType(nextType);
    setUrl(config.url ?? "");
    setHealthStatusUrl(config.healthStatusUrl ?? "");
    setBrokerUrl(config.brokerUrl ?? "");
    setTopic(config.topic ?? "");
    setGpioChip(config.chip ?? "gpiochip0");
    setGpioPin(String(config.pin ?? 17));
    setGpioProfile(config.profile === "pir-motion" ? "pir-motion" : "generic");
    setGpioPull(config.pull ?? "off");
    setGpioEdge(config.edge ?? "both");
    setGpioDebounceMs(String(config.debounceMs ?? 100));
    setGpioActiveState(config.activeState ?? "high");
    setCameraMode(config.mode ?? "photo");
    setCameraWidth(String(config.width ?? 1280));
    setCameraHeight(String(config.height ?? 720));
    setCameraDurationMs(String(config.durationMs ?? 1000));
    setCameraFps(String(config.fps ?? 30));
    setBmeSensor(config.sensor ?? "bme280");
    setBmeBus(String(config.bus ?? 1));
    setBmeAddress(config.address ?? "0x76");
    setMethod(config.method ?? "GET");
  }

  function fillFromTemplate(template: DataSourceTemplate) {
    fillFields(template.title, template.description, template.type, template.config);
  }

  function fillFromSource(source: DataSource) {
    fillFields(source.name, source.description ?? "", source.type, source.config);
  }

  function reset() {
    setName("");
    setDescription("");
    setType("json-api");
    setUrl("");
    setHealthStatusUrl("");
    setBrokerUrl("");
    setTopic("");
    setGpioChip("gpiochip0");
    setGpioPin("17");
    setGpioProfile("generic");
    setGpioPull("off");
    setGpioEdge("both");
    setGpioDebounceMs("100");
    setGpioActiveState("high");
    setCameraMode("photo");
    setCameraWidth("1280");
    setCameraHeight("720");
    setCameraDurationMs("1000");
    setCameraFps("30");
    setBmeSensor("bme280");
    setBmeBus("1");
    setBmeAddress("0x76");
    setMethod("GET");
  }

  return {
    fields: {
      name,
      setName,
      description,
      setDescription,
      type,
      setType,
      url,
      setUrl,
      healthStatusUrl,
      setHealthStatusUrl,
      brokerUrl,
      setBrokerUrl,
      topic,
      setTopic,
      gpioChip,
      setGpioChip,
      gpioPin,
      setGpioPin,
      gpioProfile,
      setGpioProfile,
      gpioPull,
      setGpioPull,
      gpioEdge,
      setGpioEdge,
      gpioDebounceMs,
      setGpioDebounceMs,
      gpioActiveState,
      setGpioActiveState,
      cameraMode,
      setCameraMode,
      cameraWidth,
      setCameraWidth,
      cameraHeight,
      setCameraHeight,
      cameraDurationMs,
      setCameraDurationMs,
      cameraFps,
      setCameraFps,
      bmeSensor,
      setBmeSensor,
      bmeBus,
      setBmeBus,
      bmeAddress,
      setBmeAddress,
      method,
      setMethod,
    },
    reset,
    fillFromTemplate,
    fillFromSource,
  };
}

export type DeviceFormFields = ReturnType<typeof useDeviceFormFields>["fields"];
