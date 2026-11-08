using UnityEngine;
using UnityEngine.EventSystems;

public class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
{
    public RectTransform handle;
    public float radius = 65f;
    public Vector2 Value { get; private set; }

    public void OnPointerDown(PointerEventData e) => OnDrag(e);

    public void OnDrag(PointerEventData e)
    {
        if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(
            (RectTransform)transform, e.position, e.pressEventCamera, out var p)) return;
        Value = Vector2.ClampMagnitude(p / radius, 1f);
        if (handle) handle.anchoredPosition = Value * radius;
    }

    public void OnPointerUp(PointerEventData e)
    {
        Value = Vector2.zero;
        if (handle) handle.anchoredPosition = Vector2.zero;
    }
}