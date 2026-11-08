using UnityEngine;

public class ThirdPersonCamera : MonoBehaviour
{
    public Transform target;
    public float distance = 5f, height = 2.2f, sensitivity = .18f, smooth = 12f;
    float yaw, pitch = 12f;
    Vector2 previous;
    bool mouseDrag;

    void LateUpdate()
    {
        Vector2 delta = Vector2.zero;
#if UNITY_EDITOR || UNITY_STANDALONE
        if (Input.GetMouseButtonDown(0)) { previous = Input.mousePosition; mouseDrag = true; }
        if (Input.GetMouseButtonUp(0)) mouseDrag = false;
        if (mouseDrag) { Vector2 p = Input.mousePosition; delta = p - previous; previous = p; }
#endif
        for (int i = 0; i < Input.touchCount; i++)
        {
            Touch t = Input.GetTouch(i);
            if (t.position.x > Screen.width * .4f && t.phase == TouchPhase.Moved)
                delta += t.deltaPosition;
        }
        yaw += delta.x * sensitivity;
        pitch = Mathf.Clamp(pitch - delta.y * sensitivity, -5f, 55f);
        if (!target) return;
        Quaternion rot = Quaternion.Euler(pitch, yaw, 0);
        Vector3 wanted = target.position + Vector3.up * height - rot * Vector3.forward * distance;
        transform.position = Vector3.Lerp(transform.position, wanted, smooth * Time.deltaTime);
        transform.rotation = Quaternion.Slerp(transform.rotation,
            Quaternion.LookRotation(target.position + Vector3.up * 1.4f - transform.position),
            smooth * Time.deltaTime);
    }
}