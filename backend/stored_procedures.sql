-- Stored procedure for getting item details with kit information
DELIMITER //
CREATE PROCEDURE GetItemWithKitDetails(IN item_id INT)
BEGIN
    SELECT 
        i.*,
        IF(i.is_kit = TRUE, 
           (SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'item_id', ki.item_id,
                    'item_name', it.name,
                    'item_code', it.code,
                    'quantity', ki.quantity,
                    'unit_price', it.unit_price
                )
            ) 
            FROM kit_items ki 
            JOIN items it ON ki.item_id = it.id 
            WHERE ki.kit_id = i.id),
           NULL
        ) as kit_components
    FROM items i
    WHERE i.id = item_id;
END //
DELIMITER ;

-- Stored procedure for getting low stock items
DELIMITER //
CREATE PROCEDURE GetLowStockItems()
BEGIN
    SELECT * FROM items 
    WHERE stock <= min_stock 
    AND status = 'Active'
    ORDER BY (stock - min_stock) ASC;
END //
DELIMITER ;

-- Stored procedure for updating stock
DELIMITER //
CREATE PROCEDURE UpdateItemStock(IN item_id INT, IN new_stock INT)
BEGIN
    UPDATE items SET stock = new_stock WHERE id = item_id;
    SELECT ROW_COUNT() as affected_rows;
END //
DELIMITER ;