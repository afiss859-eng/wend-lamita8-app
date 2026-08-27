/**
 * camera-fix.js — Détection contexte + stratégies alternatives
 * Problème : file:// bloque getUserMedia sur Chrome Android
 * Solutions : input capture natif Android (fonctionne toujours)
 */
const CameraFix = (() => {

  function isFileProtocol() {
    return location.protocol === 'file:';
  }

  function isCapacitor() {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.();
  }

  function canUseGetUserMedia() {
    return !isFileProtocol() && !!navigator.mediaDevices?.getUserMedia;
  }

  // Retourne la meilleure stratégie disponible
  function getBestStrategy() {
    if (isCapacitor()) return 'capacitor';  // APK compilé
    if (canUseGetUserMedia()) return 'getusermedia'; // HTTPS/localhost
    return 'input-capture'; // file:// → input natif Android
  }

  return { isFileProtocol, canUseGetUserMedia, getBestStrategy, isCapacitor };
})();
