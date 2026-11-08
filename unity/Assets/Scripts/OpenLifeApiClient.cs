using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

[Serializable] public class OpenLifeUser { public int id; public string username; public string role; }
[Serializable] public class OpenLifeLoginResponse { public string token; public OpenLifeUser user; }
[Serializable] public class OpenLifeProfile { public string display_name; public int level; public int coins; }
[Serializable] public class OpenLifeMeResponse { public OpenLifeUser user; public OpenLifeProfile profile; }
[Serializable] public class OpenLifeError { public string error; }

public class OpenLifeApiClient : MonoBehaviour
{
    public static OpenLifeApiClient Instance { get; private set; }
    [SerializeField] string baseUrl = "http://127.0.0.1:3000";
    [SerializeField] int timeoutSeconds = 12;
    public OpenLifeUser CurrentUser { get; private set; }
    public OpenLifeProfile CurrentProfile { get; private set; }
    public bool IsAuthenticated => !string.IsNullOrEmpty(Token);
    public string LastError { get; private set; }
    string Token { get; set; }

    const string TokenKey = "openlife_session_token";
    void Awake()
    {
        if (Instance && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
        Token = PlayerPrefs.GetString(TokenKey, "");
    }

    public void ConfigureServer(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        { LastError = "نشانی سرور معتبر نیست"; return; }
        baseUrl = uri.ToString().TrimEnd('/');
    }

    public void Login(string username, string password, Action<bool, string> completed)
    {
        StartCoroutine(Post("/api/login",
            JsonUtility.ToJson(new Credentials { username = username, password = password }),
            false, (ok, body) =>
            {
                if (!ok) { completed?.Invoke(false, ReadError(body)); return; }
                var data = JsonUtility.FromJson<OpenLifeLoginResponse>(body);
                if (data == null || string.IsNullOrEmpty(data.token))
                { completed?.Invoke(false, "پاسخ ورود سرور نامعتبر است"); return; }
                SaveSession(data);
                completed?.Invoke(true, "ورود موفق بود");
            }));
    }

    public void Register(string username, string password, Action<bool, string> completed)
    {
        StartCoroutine(Post("/api/register",
            JsonUtility.ToJson(new Credentials { username = username, password = password }),
            false, (ok, body) =>
            {
                if (!ok) { completed?.Invoke(false, ReadError(body)); return; }
                var data = JsonUtility.FromJson<OpenLifeLoginResponse>(body);
                if (data == null || string.IsNullOrEmpty(data.token))
                { completed?.Invoke(false, "پاسخ ثبت‌نام سرور نامعتبر است"); return; }
                SaveSession(data);
                completed?.Invoke(true, "حساب ساخته شد");
            }));
    }

    public void RefreshProfile(Action<bool, string> completed)
    {
        StartCoroutine(Get("/api/me", (ok, body) =>
        {
            if (!ok) { completed?.Invoke(false, ReadError(body)); return; }
            var data = JsonUtility.FromJson<OpenLifeMeResponse>(body);
            if (data == null) { completed?.Invoke(false, "پروفایل نامعتبر است"); return; }
            CurrentUser = data.user;
            CurrentProfile = data.profile;
            completed?.Invoke(true, "اطلاعات دریافت شد");
        }));
    }

    public void UpdateWorldPosition(Vector3 position, Action<bool, string> completed = null)
    {
        var body = JsonUtility.ToJson(new PositionBody { x = position.x, y = position.y, z = position.z });
        StartCoroutine(Post("/api/world/position", body, true,
            (ok, response) => completed?.Invoke(ok, ok ? "موقعیت ذخیره شد" : ReadError(response))));
    }

    public void GetWorldPlayers(Action<WorldPlayer[], string> completed)
    {
        StartCoroutine(Get("/api/world/players", (ok, body) =>
        {
            if (!ok) { completed?.Invoke(null, ReadError(body)); return; }
            var data = JsonUtility.FromJson<WorldPlayersResponse>(body);
            completed?.Invoke(data != null ? data.players : new WorldPlayer[0], "دریافت بازیکنان انجام شد");
        }));
    }

    public void SubmitReport(string target, string reason, Action<bool, string> completed)
    {
        StartCoroutine(Post("/api/reports",
            JsonUtility.ToJson(new ReportBody { target = target, reason = reason }),
            true, (ok, body) => completed?.Invoke(ok, ok ? "گزارش ثبت شد" : ReadError(body))));
    }

    public void Logout()
    {
        Token = "";
        CurrentUser = null;
        CurrentProfile = null;
        PlayerPrefs.DeleteKey(TokenKey);
        PlayerPrefs.Save();
    }

    void SaveSession(OpenLifeLoginResponse data)
    {
        Token = data.token;
        CurrentUser = data.user;
        PlayerPrefs.SetString(TokenKey, Token);
        PlayerPrefs.Save();
    }

    IEnumerator Get(string path, Action<bool, string> done)
    {
        using (var request = UnityWebRequest.Get(baseUrl + path))
        {
            request.timeout = timeoutSeconds;
            if (!string.IsNullOrEmpty(Token)) request.SetRequestHeader("Authorization", "Bearer " + Token);
            yield return request.SendWebRequest();
            done?.Invoke(request.result == UnityWebRequest.Result.Success, request.downloadHandler.text);
        }
    }

    IEnumerator Post(string path, string json, bool authenticated, Action<bool, string> done)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        using (var request = new UnityWebRequest(baseUrl + path, "POST"))
        {
            request.uploadHandler = new UploadHandlerRaw(bytes);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.timeout = timeoutSeconds;
            request.SetRequestHeader("Content-Type", "application/json");
            if (authenticated && !string.IsNullOrEmpty(Token))
                request.SetRequestHeader("Authorization", "Bearer " + Token);
            yield return request.SendWebRequest();
            done?.Invoke(request.result == UnityWebRequest.Result.Success, request.downloadHandler.text);
        }
    }

    string ReadError(string body)
    {
        try { var parsed = JsonUtility.FromJson<OpenLifeError>(body); if (parsed != null && !string.IsNullOrEmpty(parsed.error)) return parsed.error; }
        catch { }
        LastError = "ارتباط با سرور ناموفق بود";
        return LastError;
    }

    [Serializable] public class WorldPlayer { public int id; public string username; public float x; public float y; public float z; }
    [Serializable] class WorldPlayersResponse { public WorldPlayer[] players; }
    [Serializable] class PositionBody { public float x; public float y; public float z; }
    [Serializable] class Credentials { public string username; public string password; }
    [Serializable] class ReportBody { public string target; public string reason; }
}