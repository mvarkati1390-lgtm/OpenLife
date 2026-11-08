using System;
using UnityEngine;
using UnityEngine.UI;

public class OpenLifeAuthPanel : MonoBehaviour
{
    Canvas canvas;
    InputField username, password, serverAddress;
    Text status;
    bool visible = true;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Install()
    {
        if (!FindObjectOfType<OpenLifeAuthPanel>())
            new GameObject("OpenLife Authentication UI").AddComponent<OpenLifeAuthPanel>();
    }

    void Start()
    {
        var root = new GameObject("OpenLife Auth Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        canvas = root.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var scaler = root.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);

        var panel = MakeRect("Auth Panel", root.transform, new Vector2(.5f,.68f), new Vector2(650,720));
        var bg = panel.gameObject.AddComponent<Image>();
        bg.color = new Color(.04f,.07f,.12f,.92f);
        MakeText("ورود به OpenLife", panel, new Vector2(0,300), 34);

        username = MakeInput("نام کاربری", panel, new Vector2(0,205), false);
        password = MakeInput("رمز عبور", panel, new Vector2(0,115), true);
        serverAddress = MakeInput("آدرس سرور HTTPS", panel, new Vector2(0,25), false);
        serverAddress.text = PlayerPrefs.GetString("openlife_server_url", "");
        if (!string.IsNullOrWhiteSpace(serverAddress.text) && OpenLifeApiClient.Instance)
            OpenLifeApiClient.Instance.ConfigureServer(serverAddress.text);
        MakeButton("ذخیره آدرس سرور", panel, new Vector2(0,-65), SaveServerAddress);
        MakeButton("ورود", panel, new Vector2(-145,-155), Login);
        MakeButton("ثبت نام", panel, new Vector2(145,-155), Register);
        status = MakeText("برای بازی وارد شوید", panel, new Vector2(0,-245), 22);
        MakeButton("ادامه مهمان", panel, new Vector2(0,-315), Hide);
    }

    void SaveServerAddress()
    {
        string value = serverAddress != null ? serverAddress.text.Trim() : "";
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            SetStatus("آدرس سرور معتبر نیست");
            return;
        }
        if (!OpenLifeApiClient.Instance)
        {
            SetStatus("کلاینت شبکه آماده نیست");
            return;
        }
        OpenLifeApiClient.Instance.ConfigureServer(value);
        PlayerPrefs.SetString("openlife_server_url", value.TrimEnd('/'));
        PlayerPrefs.Save();
        SetStatus("آدرس سرور ذخیره شد");
    }

    void Login()
    {
        if (!OpenLifeApiClient.Instance) { SetStatus("کلاینت شبکه آماده نیست"); return; }
        OpenLifeApiClient.Instance.Login(username.text, password.text, (ok,msg) =>
        {
            SetStatus(msg);
            if (ok) OpenLifeApiClient.Instance.RefreshProfile((loaded, result) => SetStatus(loaded ? "خوش آمدید " + OpenLifeApiClient.Instance.CurrentUser.username : result));
        });
    }

    void Register()
    {
        if (!OpenLifeApiClient.Instance) { SetStatus("کلاینت شبکه آماده نیست"); return; }
        OpenLifeApiClient.Instance.Register(username.text, password.text, (ok,msg) => SetStatus(msg));
    }

    void Hide()
    {
        visible = !visible;
        canvas.gameObject.SetActive(visible);
    }

    void SetStatus(string value) { if (status) status.text = value; }

    RectTransform MakeRect(string name, Transform parent, Vector2 anchored, Vector2 size)
    {
        var go = new GameObject(name, typeof(RectTransform));
        go.transform.SetParent(parent,false);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = new Vector2(.5f,.5f);
        rt.pivot = new Vector2(.5f,.5f);
        rt.anchoredPosition = anchored;
        rt.sizeDelta = size;
        return rt;
    }

    Text MakeText(string value, Transform parent, Vector2 pos, int fontSize)
    {
        var rt = MakeRect("Text", parent, pos, new Vector2(580,65));
        var text = rt.gameObject.AddComponent<Text>();
        text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        text.fontSize = fontSize;
        text.alignment = TextAnchor.MiddleCenter;
        text.color = Color.white;
        text.text = value;
        return text;
    }

    InputField MakeInput(string hint, Transform parent, Vector2 pos, bool secret)
    {
        var rt = MakeRect("Input " + hint, parent, pos, new Vector2(540,70));
        rt.gameObject.AddComponent<Image>().color = new Color(.12f,.16f,.23f,1);
        var field = rt.gameObject.AddComponent<InputField>();
        var text = MakeText("", rt, Vector2.zero, 25);
        text.alignment = TextAnchor.MiddleLeft;
        text.rectTransform.offsetMin = new Vector2(15,5);
        text.rectTransform.offsetMax = new Vector2(-15,-5);
        field.textComponent = text;
        var placeholder = MakeText(hint, rt, Vector2.zero, 23);
        placeholder.color = new Color(.7f,.75f,.82f);
        placeholder.alignment = TextAnchor.MiddleLeft;
        placeholder.rectTransform.offsetMin = new Vector2(15,5);
        placeholder.rectTransform.offsetMax = new Vector2(-15,-5);
        field.placeholder = placeholder;
        field.contentType = secret ? InputField.ContentType.Password : InputField.ContentType.Standard;
        return field;
    }

    void MakeButton(string label, Transform parent, Vector2 pos, UnityEngine.Events.UnityAction action)
    {
        var rt = MakeRect("Button " + label, parent, pos, new Vector2(240,68));
        var image = rt.gameObject.AddComponent<Image>();
        image.color = new Color(.12f,.42f,.78f,1);
        var button = rt.gameObject.AddComponent<Button>();
        button.onClick.AddListener(action);
        var text = MakeText(label, rt, Vector2.zero, 24);
        text.rectTransform.sizeDelta = rt.sizeDelta;
    }
}