---

title: Explore a map
description: Spatial focus, selection and explicit travel.
sidebar:
  order: 3
---

## The lens is spatial

Thoughts near the centre grow; peripheral thoughts get smaller as you pan.
Selection is separate from that magnification. Drag the map or use the arrow
keys while the viewer is focused. Wheel/trackpad input and zoom controls adjust
the view. Overview fits an undistorted map.

Click once to select. Selection highlights immediate explicit connections, not
every thought reachable through the graph. Double-click an ordinary thought to
explore its temporary neighbourhood. Escape returns to the retained map view;
the temporary arrangement does not overwrite authored positions.

## Keyboard controls

| Keys                | Action                                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| Arrows              | Pan; holding accelerates                                                      |
| Ctrl + arrows       | Browse visible thoughts without travelling                                    |
| Shift + arrows      | Preview incident destinations; repeated presses cycle choices                 |
| Space               | Accept and centre the current target                                          |
| Enter               | Activate a portal or switch the ordinary thought's view                       |
| Escape              | Cancel a pending connection choice first; otherwise return from neighbourhood |
| Ctrl + plus / minus | Zoom the focused viewer                                                       |

Shortcuts are scoped to viewer/node focus. Editing fields and ordinary controls
keep their native keyboard behavior. Tab still moves between controls.

## Portals and links

`map_link` opens another Lensmap; `external_link` names an ordinary web/file
resource. Portals are real thoughts, with optional notes, IDs and connections.
Selecting one does not immediately navigate. Use its explicit Open action,
double-click, or Enter while it is the viewer's target.

Relative destinations resolve from the containing map's source location, not
from whichever page happens to host the viewer. A browser cannot directly open
arbitrary local files; an authorized editor host owns local-resource handling.

Map Back/Forward restores prior selection and camera. Failed loading keeps the
current map. A missing target offers **Open destination map anyway**, which drops
only that missing fragment and opens the destination in Overview.

For exact behavior and host boundaries, see
[default connections](https://github.com/nicodoggie/lensmap/blob/main/docs/default-connections.md).
