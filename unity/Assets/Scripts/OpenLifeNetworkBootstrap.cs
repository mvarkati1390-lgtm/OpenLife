using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

public class OpenLifeNetworkBootstrap : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    static void Install()
    {
        if (!FindObjectOfType<OpenLifeApiClient>())
            new GameObject("OpenLife API Client").AddComponent<OpenLifeApiClient>();
    }
}