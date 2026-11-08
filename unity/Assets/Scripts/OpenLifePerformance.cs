using UnityEngine;

public class OpenLifePerformance : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    static void Configure()
    {
        Application.targetFrameRate = 30;
        Application.backgroundLoadingPriority = ThreadPriority.Low;
        QualitySettings.vSyncCount = 0;
        QualitySettings.antiAliasing = 0;
        QualitySettings.shadows = ShadowQuality.HardOnly;
        QualitySettings.shadowResolution = ShadowResolution.Low;
        QualitySettings.shadowDistance = 35f;
        QualitySettings.pixelLightCount = 1;
        QualitySettings.anisotropicFiltering = AnisotropicFiltering.Disable;
        QualitySettings.lodBias = 0.7f;
        QualitySettings.maximumLODLevel = 1;
        QualitySettings.softParticles = false;
        QualitySettings.realtimeReflectionProbes = false;
        QualitySettings.billboardsFaceCameraPosition = true;
        Time.fixedDeltaTime = 0.02f;
        Screen.sleepTimeout = SleepTimeout.NeverSleep;
    }
}