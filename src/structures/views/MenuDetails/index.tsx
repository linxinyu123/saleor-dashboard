// @ts-strict-ignore
import ActionDialog from "@dashboard/components/ActionDialog";
import {
  useMenuDeleteMutation,
  useMenuDetailsQuery,
  useMenuItemCreateMutation,
  useMenuItemUpdateMutation,
  useMenuUpdateMutation,
} from "@dashboard/graphql";
import useNavigator from "@dashboard/hooks/useNavigator";
import useNotifier from "@dashboard/hooks/useNotifier";
import { pageUrl } from "@dashboard/modeling/urls";
import React from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { categoryUrl } from "../../../categories/urls";
import { collectionUrl } from "../../../collections/urls";
import { extractMutationErrors, maybe } from "../../../misc";
import MenuDetailsPage, { MenuDetailsSubmitData } from "../../components/MenuDetailsPage";
import { findNode, getNode } from "../../components/MenuDetailsPage/tree";
import MenuItemDialog, {
  MenuItemDialogFormData,
  MenuItemType,
} from "../../components/MenuItemDialog";
import {
  getItemId,
  getItemType,
  unknownTypeError,
} from "../../components/MenuItemsSortableTree/utils";
import { menuUrl, MenuUrlQueryParams } from "../../urls";
import { handleDelete, handleItemCreate, handleItemUpdate, handleUpdate } from "./successHandlers";
import {
  getInitialMenuItemLabel,
  getInitialMenuItemValue,
  getMenuItemCreateInputData,
  getMenuItemInputData,
  getMoves,
  getRemoveIds,
} from "./utils";

interface MenuDetailsProps {
  id: string;
  params: MenuUrlQueryParams;
}

const MenuDetails: React.FC<MenuDetailsProps> = ({ id, params }) => {
  const navigate = useNavigator();
  const notify = useNotifier();
  const intl = useIntl();
  const { data, loading, refetch } = useMenuDetailsQuery({
    variables: { id },
  });
  const [menuDelete, menuDeleteOpts] = useMenuDeleteMutation({
    onCompleted: data => handleDelete(data, navigate, notify, intl),
  });
  const [menuUpdate, menuUpdateOpts] = useMenuUpdateMutation({
    onCompleted: data => handleUpdate(data, notify, refetch, intl),
  });
  const [menuItemCreate, menuItemCreateOpts] = useMenuItemCreateMutation({
    onCompleted: data => handleItemCreate(data, notify, closeModal, intl),
  });
  const [menuItemUpdate, menuItemUpdateOpts] = useMenuItemUpdateMutation({
    onCompleted: data => handleItemUpdate(data, id, navigate, notify, intl),
  });
  const closeModal = () =>
    navigate(
      menuUrl(id, {
        ...params,
        action: undefined,
        id: undefined,
      }),
      { replace: true },
    );
  const handleItemClick = (id: string, type: MenuItemType) => {
    switch (type) {
      case "category":
        navigate(categoryUrl(id));
        break;

      case "collection":
        navigate(collectionUrl(id));
        break;

      case "page":
        navigate(pageUrl(id));
        break;

      case "link":
        window.open(id, "blank");
        break;

      default:
        throw unknownTypeError;
    }
  };
  const handleMenuItemCreate = (data: MenuItemDialogFormData) =>
    extractMutationErrors(
      menuItemCreate({
        variables: {
          input: getMenuItemCreateInputData(id, data),
        },
      }),
    );
  const handleMenuItemUpdate = (data: MenuItemDialogFormData) =>
    extractMutationErrors(
      menuItemUpdate({
        variables: {
          id: params.id,
          input: getMenuItemInputData(data),
        },
      }),
    );
  const menuItem = maybe(() => getNode(data.menu.items, findNode(data.menu.items, params.id)));
  const initialMenuItemUpdateFormData: MenuItemDialogFormData = {
    id: maybe(() => getItemId(menuItem)),
    name: maybe(() => menuItem.name, "..."),
    linkType: maybe<MenuItemType>(() => getItemType(menuItem), "category"),
    linkValue: getInitialMenuItemValue(menuItem),
  };
  // This is a workaround to let know <MenuDetailsPage />
  // that it should clean operation stack if mutations
  // were successful
  const handleSubmit = async (data: MenuDetailsSubmitData) => {
    const result = await menuUpdate({
      variables: {
        id,
        moves: getMoves(data),
        name: data.name,
        removeIds: getRemoveIds(data),
      },
    });

    return [
      ...result.data.menuItemBulkDelete.errors,
      ...result.data.menuItemMove.errors,
      ...result.data.menuUpdate.errors,
    ];
  };

  return (
    <>
      <MenuDetailsPage
        disabled={loading}
        errors={[
          ...(menuUpdateOpts.data?.menuUpdate.errors || []),
          ...(menuUpdateOpts.data?.menuItemMove.errors || []),
          ...(menuUpdateOpts.data?.menuUpdate.errors || []),
        ]}
        menu={maybe(() => data.menu)}
        onDelete={() =>
          navigate(
            menuUrl(id, {
              action: "remove",
            }),
          )
        }
        onItemAdd={() =>
          navigate(
            menuUrl(id, {
              action: "add-item",
            }),
          )
        }
        onItemClick={handleItemClick}
        onItemEdit={itemId =>
          navigate(
            menuUrl(id, {
              action: "edit-item",
              id: itemId,
            }),
          )
        }
        onSubmit={handleSubmit}
        saveButtonState={menuUpdateOpts.status}
      />
      <ActionDialog
        open={params.action === "remove"}
        onClose={closeModal}
        confirmButtonState={menuDeleteOpts.status}
        onConfirm={() => extractMutationErrors(menuDelete({ variables: { id } }))}
        variant="delete"
        title={intl.formatMessage({
          id: "x79cEk",
          defaultMessage: "Delete structure",
          description: "dialog header",
        })}
      >
        <FormattedMessage
          id="U2DyeR"
          defaultMessage="Are you sure you want to delete structure {menuName}?"
          values={{
            menuName: <strong>{maybe(() => data.menu.name, "...")}</strong>,
          }}
        />
      </ActionDialog>

      <MenuItemDialog
        open={params.action === "add-item"}
        errors={maybe(() => menuItemCreateOpts.data.menuItemCreate.errors, [])}
        confirmButtonState={menuItemCreateOpts.status}
        disabled={menuItemCreateOpts.loading}
        onClose={closeModal}
        onSubmit={handleMenuItemCreate}
      />
      <MenuItemDialog
        open={params.action === "edit-item"}
        errors={maybe(() => menuItemUpdateOpts.data.menuItemUpdate.errors, [])}
        initial={initialMenuItemUpdateFormData}
        initialDisplayValue={getInitialMenuItemLabel(menuItem)}
        confirmButtonState={menuItemUpdateOpts.status}
        disabled={menuItemUpdateOpts.loading}
        onClose={closeModal}
        onSubmit={handleMenuItemUpdate}
      />
    </>
  );
};

MenuDetails.displayName = "MenuDetails";

export default MenuDetails;
