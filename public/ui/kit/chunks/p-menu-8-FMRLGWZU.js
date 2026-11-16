import"./chunk-DCANE7XH.js";var u=`import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/components/ui/menu";

export default function Particle() {
  return (
    <Menu>
      <MenuTrigger render={<Button variant="outline" />}>Open menu</MenuTrigger>
      <MenuPopup>
        <MenuItem closeOnClick>Profile</MenuItem>
        <MenuItem closeOnClick>Settings</MenuItem>
        <MenuItem closeOnClick>Log out</MenuItem>
      </MenuPopup>
    </Menu>
  );
}
`;export{u as default};
