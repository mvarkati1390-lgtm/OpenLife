using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

public class OpenLifeBootstrap : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        if (!FindObjectOfType<OpenLifeBootstrap>())
            new GameObject("OpenLife Bootstrap").AddComponent<OpenLifeBootstrap>();
    }

    void Start()
    {
        Application.targetFrameRate = 30;
        RenderSettings.ambientLight = new Color(.65f, .67f, .7f);
        SetupLighting();
        BuildPlayer();
        BuildUI();
    }

    void SetupLighting()
    {
        RenderSettings.ambientLight = new Color(.55f, .57f, .6f);
        if (!FindObjectOfType<Light>())
        {
            var sun = new GameObject("Sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 1.05f;
            sun.transform.rotation = Quaternion.Euler(50, -30, 0);
        }
    }

    void BuildPlayer()
    {
        var player = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        player.name = "Player";
        player.transform.position = new Vector3(0, 1.1f, 0);
        Destroy(player.GetComponent<CapsuleCollider>());
        var cc = player.AddComponent<CharacterController>();
        cc.height = 2; cc.radius = .45f;

        var camObj = new GameObject("Third Person Camera");
        var cam = camObj.AddComponent<Camera>();
        cam.tag = "MainCamera";
        cam.fieldOfView = 65;
        var follow = camObj.AddComponent<ThirdPersonCamera>();
        follow.target = player.transform;

        player.AddComponent<OpenLifeCharacterVisual>();
        var mover = player.AddComponent<ThirdPersonPlayer>();
        player.AddComponent<OpenLifeWorldSync>();
        mover.cameraTransform = camObj.transform;
    }

    void BuildUI()
    {
        if (!FindObjectOfType<EventSystem>())
            new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));

        var root = new GameObject("Mobile UI", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        var canvas = root.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var scaler = root.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);

        var baseImage = MakeImage(root.transform, new Vector2(.15f,.16f), new Vector2(180,180),
            new Color(.04f,.06f,.1f,.4f));
        var handle = MakeImage(baseImage.transform, new Vector2(.5f,.5f), new Vector2(76,76),
            new Color(.9f,.93f,1f,.85f));
        var stick = baseImage.AddComponent<VirtualJoystick>();
        stick.handle = handle.rectTransform;
        FindObjectOfType<ThirdPersonPlayer>().joystick = stick;

        MakeLabel(root.transform, "OPENLIFE", 32, new Vector2(.5f,.94f), new Vector2(0,0));
        MakeLabel(root.transform, "حرکت با جوی‌استیک | چرخش دوربین با کشیدن صفحه", 22,
            new Vector2(.5f,.045f), new Vector2(0,0));
    }

    Image MakeImage(Transform parent, Vector2 anchor, Vector2 size, Color color)
    {
        var go = new GameObject("Touch Control", typeof(Image));
        go.transform.SetParent(parent, false);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = anchor;
        rt.pivot = new Vector2(.5f,.5f);
        rt.anchoredPosition = Vector2.zero;
        rt.sizeDelta = size;
        var image = go.GetComponent<Image>();
        image.color = color;
        return image;
    }

    void MakeLabel(Transform parent, string value, int size, Vector2 anchor, Vector2 offset)
    {
        var go = new GameObject("Label", typeof(Text));
        go.transform.SetParent(parent, false);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = anchor;
        rt.pivot = new Vector2(.5f,.5f);
        rt.anchoredPosition = offset;
        rt.sizeDelta = new Vector2(1000,70);
        var label = go.GetComponent<Text>();
        label.text = value;
        label.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        label.fontSize = size;
        label.alignment = TextAnchor.MiddleCenter;
        label.color = Color.white;
    }
}