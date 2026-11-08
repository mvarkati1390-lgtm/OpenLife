using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class OpenLifeWorldSync : MonoBehaviour
{
    [SerializeField] float sendInterval = 1.0f;
    [SerializeField] float receiveInterval = 1.5f;
    [SerializeField] float remoteSmooth = 10f;
    readonly Dictionary<int, Transform> remotePlayers = new Dictionary<int, Transform>();
    readonly Dictionary<int, Vector3> remoteTargets = new Dictionary<int, Vector3>();
    OpenLifeApiClient api;
    float nextSend;
    float nextReceive;
    bool receiving;

    void Start()
    {
        api = OpenLifeApiClient.Instance;
    }

    void Update()
    {
        if (!api) api = OpenLifeApiClient.Instance;
        if (!api || !api.IsAuthenticated) return;

        if (Time.unscaledTime >= nextSend)
        {
            nextSend = Time.unscaledTime + sendInterval;
            api.UpdateWorldPosition(transform.position);
        }

        if (!receiving && Time.unscaledTime >= nextReceive)
        {
            nextReceive = Time.unscaledTime + receiveInterval;
            receiving = true;
            api.GetWorldPlayers((players, message) =>
            {
                receiving = false;
                if (players == null) return;
                ApplyPlayers(players);
            });
        }

        foreach (var pair in remotePlayers)
        {
            if (!pair.Value || !remoteTargets.TryGetValue(pair.Key, out var target)) continue;
            pair.Value.position = Vector3.Lerp(pair.Value.position, target, remoteSmooth * Time.deltaTime);
        }
    }

    void ApplyPlayers(OpenLifeApiClient.WorldPlayer[] players)
    {
        var seen = new HashSet<int>();
        foreach (var player in players)
        {
            if (player == null || player.id <= 0 || player.id == (api.CurrentUser != null ? api.CurrentUser.id : -1))
                continue;

            seen.Add(player.id);
            Vector3 position = new Vector3(player.x, player.y, player.z);
            if (!remotePlayers.TryGetValue(player.id, out var avatar) || !avatar)
            {
                avatar = CreateRemoteAvatar(player);
                remotePlayers[player.id] = avatar.transform;
            }
            remoteTargets[player.id] = position;
        }

        var remove = new List<int>();
        foreach (var pair in remotePlayers)
            if (!seen.Contains(pair.Key)) remove.Add(pair.Key);

        foreach (int id in remove)
        {
            if (remotePlayers[id]) Destroy(remotePlayers[id].gameObject);
            remotePlayers.Remove(id);
            remoteTargets.Remove(id);
        }
    }

    GameObject CreateRemoteAvatar(OpenLifeApiClient.WorldPlayer player)
    {
        var avatar = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        avatar.name = "Remote Player " + player.id;
        avatar.transform.position = new Vector3(player.x, player.y, player.z);
        var collider = avatar.GetComponent<Collider>();
        if (collider) Destroy(collider);
        avatar.AddComponent<OpenLifeCharacterVisual>();

        var nameObject = new GameObject("Player Name");
        nameObject.transform.SetParent(avatar.transform, false);
        nameObject.transform.localPosition = new Vector3(0, 1.65f, 0);
        var label = nameObject.AddComponent<TextMesh>();
        label.text = string.IsNullOrEmpty(player.username) ? "Player" : player.username;
        label.characterSize = 0.08f;
        label.fontSize = 48;
        label.anchor = TextAnchor.MiddleCenter;
        label.alignment = TextAlignment.Center;
        label.color = Color.white;
        return avatar;
    }

    void OnDestroy()
    {
        foreach (var avatar in remotePlayers.Values)
            if (avatar) Destroy(avatar.gameObject);
        remotePlayers.Clear();
        remoteTargets.Clear();
    }
}
