import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  TextInput, 
  Modal, 
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  RefreshControl,
  Switch
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';

const UsersScreen = () => {
  // State tanımlamaları
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' veya 'edit'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterApplied, setFilterApplied] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    id: null,
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'user',
    is_active: true,
  });
  
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
  });

  const flatListRef = useRef(null);

  // Kullanıcıları getir
  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Toplam kullanıcı sayısını almak için sorgu
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
        
      if (countError) throw countError;
      
      // Toplam sayfa sayısını hesapla
      setTotalCount(count);
      setTotalPages(Math.ceil(count / pageSize));
      
      // Kullanıcıları getir
      let query = supabase
        .from('profiles')
        .select('*');
        
      // Arama filtresi
      if (searchQuery) {
        query = query.or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`);
      }
      
      // Sayfalama
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await query
        .range(from, to)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log(`${data.length} kullanıcı yüklendi.`);
      setUsers(data || []);
      
    } catch (error) {
      console.error('Kullanıcı verisi çekilirken hata:', error);
      Alert.alert('Hata', 'Kullanıcılar yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Sayfa değiştiğinde veya filtre uygulandığında kullanıcıları tekrar getir
  useEffect(() => {
    fetchUsers();
  }, [currentPage, pageSize, searchQuery]);

  // Sayfayı yenile
  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Form alanlarını sıfırla
  const resetForm = () => {
    setFormData({
      id: null,
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      role: 'user',
      is_active: true,
    });
    
    setPasswordData({
      password: '',
      confirmPassword: '',
    });
  };

  // Düzenleme modunu başlat
  const startEdit = (item) => {
    setFormData({
      id: item.id,
      email: item.email || '',
      first_name: item.first_name || '',
      last_name: item.last_name || '',
      phone: item.phone || '',
      role: item.role || 'user',
      is_active: item.is_active !== false,
    });
    setFormMode('edit');
    setModalVisible(true);
  };

  // Kullanıcı ekle veya güncelle
  const handleSaveUser = async () => {
    // Form doğrulama
    if (!formData.email.trim()) {
      Alert.alert('Hata', 'E-posta adresi boş olamaz.');
      return;
    }
    
    if (!formData.email.includes('@')) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi giriniz.');
      return;
    }

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      Alert.alert('Hata', 'Ad ve soyad alanları boş olamaz.');
      return;
    }

    // Yeni kullanıcı oluşturulurken şifre kontrolü
    if (formMode === 'add') {
      if (!passwordData.password) {
        Alert.alert('Hata', 'Şifre alanı boş olamaz.');
        return;
      }
      
      if (passwordData.password.length < 6) {
        Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
        return;
      }
      
      if (passwordData.password !== passwordData.confirmPassword) {
        Alert.alert('Hata', 'Şifreler eşleşmiyor.');
        return;
      }
    }

    try {
      setLoading(true);
      
      if (formMode === 'add') {
        // Önce auth tablosuna kullanıcı ekle
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: passwordData.password,
          options: {
            data: {
              first_name: formData.first_name,
              last_name: formData.last_name,
            }
          }
        });
        
        if (authError) throw authError;
        
        if (!authData.user) {
          throw new Error('Kullanıcı oluşturulamadı.');
        }
        
        // Profil bilgilerini kaydet
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            phone: formData.phone.trim(),
            role: formData.role,
            is_active: formData.is_active,
            updated_at: new Date()
          })
          .eq('id', authData.user.id);
          
        if (profileError) throw profileError;
        
        Alert.alert('Başarılı', 'Kullanıcı başarıyla eklendi.');
      } else {
        // Mevcut kullanıcıyı güncelle
        const { error } = await supabase
          .from('profiles')
          .update({
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            phone: formData.phone.trim(),
            role: formData.role,
            is_active: formData.is_active,
            updated_at: new Date()
          })
          .eq('id', formData.id);
          
        if (error) throw error;
        
        Alert.alert('Başarılı', 'Kullanıcı başarıyla güncellendi.');
      }
      
      setModalVisible(false);
      resetForm();
      fetchUsers();
      
    } catch (error) {
      console.error('Kullanıcı kaydedilirken hata:', error);
      Alert.alert('Hata', 'Kullanıcı kaydedilirken bir sorun oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcı durumunu değiştir (aktif/pasif)
  const toggleUserStatus = async (user) => {
    try {
      setLoading(true);
      
      const newStatus = !user.is_active;
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_active: newStatus,
          updated_at: new Date()
        })
        .eq('id', user.id);
        
      if (error) throw error;
      
      // Listeyi güncelle
      setUsers(users.map(item => 
        item.id === user.id ? {...item, is_active: newStatus} : item
      ));
      
      Alert.alert(
        'Başarılı', 
        `Kullanıcı durumu ${newStatus ? 'aktif' : 'pasif'} olarak güncellendi.`
      );
      
    } catch (error) {
      console.error('Kullanıcı durumu güncellenirken hata:', error);
      Alert.alert('Hata', 'Kullanıcı durumu güncellenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Sayfalama fonksiyonları
  const goToPage = (page) => {
    if (page >= 0 && page < totalPages) {
      setCurrentPage(page);
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  };

  const goToPreviousPage = () => {
    goToPage(currentPage - 1);
  };

  const goToNextPage = () => {
    goToPage(currentPage + 1);
  };

  // Kullanıcı satırı render fonksiyonu
  const renderUserItem = ({ item }) => (
    <View style={styles.tableRow}>
      <View style={[styles.tableCell, { flex: 1.5 }]}>
        <Text style={styles.cellText}>{item.email}</Text>
      </View>
      <View style={styles.tableCell}>
        <Text style={styles.cellText}>{item.first_name} {item.last_name}</Text>
      </View>
      <View style={styles.tableCell}>
        <Text style={styles.cellText}>
          {item.role === 'admin' ? 'Yönetici' : item.role === 'manager' ? 'Müdür' : 'Kullanıcı'}
        </Text>
      </View>
      <View style={styles.tableCell}>
        <View style={[
          styles.statusBadge, 
          { backgroundColor: item.is_active ? '#4caf50' : '#f44336' }
        ]}>
          <Text style={styles.statusText}>
            {item.is_active ? 'Aktif' : 'Pasif'}
          </Text>
        </View>
      </View>
      <View style={[styles.tableCell, { flex: 0.8, justifyContent: 'center' }]}>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => startEdit(item)}
          >
            <MaterialIcons name="edit" size={20} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, item.is_active ? styles.deactivateButton : styles.activateButton]}
            onPress={() => toggleUserStatus(item)}
          >
            <MaterialIcons name={item.is_active ? "block" : "check-circle"} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Tablo başlığı render fonksiyonu
  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <View style={[styles.tableHeaderCell, { flex: 1.5 }]}>
        <Text style={styles.tableHeaderText}>E-posta</Text>
      </View>
      <View style={styles.tableHeaderCell}>
        <Text style={styles.tableHeaderText}>Ad Soyad</Text>
      </View>
      <View style={styles.tableHeaderCell}>
        <Text style={styles.tableHeaderText}>Yetki</Text>
      </View>
      <View style={styles.tableHeaderCell}>
        <Text style={styles.tableHeaderText}>Durum</Text>
      </View>
      <View style={[styles.tableHeaderCell, { flex: 0.8 }]}>
        <Text style={styles.tableHeaderText}>İşlemler</Text>
      </View>
    </View>
  );

  // Sayfalama kontrollerini render et
  const renderPaginationControls = () => (
    <View style={styles.paginationContainer}>
      <View style={styles.paginationInfo}>
        <Text style={styles.paginationText}>
          Toplam {totalCount} kullanıcı 
        </Text>
      </View>
      <View style={styles.pageControls}>
        <TouchableOpacity 
          style={[styles.pageButton, currentPage === 0 && styles.disabledButton]}
          onPress={goToPreviousPage}
          disabled={currentPage === 0}
        >
          <MaterialIcons name="chevron-left" size={24} color={currentPage === 0 ? "#999" : "#fff"} />
        </TouchableOpacity>
        
        <View style={styles.pageIndicator}>
          <Text style={styles.pageIndicatorText}>
            Sayfa {currentPage + 1} / {totalPages}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.pageButton, currentPage === totalPages - 1 && styles.disabledButton]}
          onPress={goToNextPage}
          disabled={currentPage === totalPages - 1}
        >
          <MaterialIcons name="chevron-right" size={24} color={currentPage === totalPages - 1 ? "#999" : "#fff"} />
        </TouchableOpacity>
      </View>
      <View style={styles.pageSizeSelector}>
        <Text style={styles.pageSizeLabel}>Sayfa Başına:</Text>
        <TouchableOpacity
          style={[styles.pageSizeButton, pageSize === 5 && styles.activePageSizeButton]}
          onPress={() => {
            setPageSize(5);
            setCurrentPage(0);
          }}
        >
          <Text style={[styles.pageSizeButtonText, pageSize === 5 && styles.activePageSizeButtonText]}>5</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pageSizeButton, pageSize === 10 && styles.activePageSizeButton]}
          onPress={() => {
            setPageSize(10);
            setCurrentPage(0);
          }}
        >
          <Text style={[styles.pageSizeButtonText, pageSize === 10 && styles.activePageSizeButtonText]}>10</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pageSizeButton, pageSize === 20 && styles.activePageSizeButton]}
          onPress={() => {
            setPageSize(20);
            setCurrentPage(0);
          }}
        >
          <Text style={[styles.pageSizeButtonText, pageSize === 20 && styles.activePageSizeButtonText]}>20</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kullanıcılar</Text>
        <View style={styles.headerActions}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Kullanıcı Ara..."
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setCurrentPage(0);
                setFilterApplied(!!text);
              }}
            />
            {searchQuery ? (
              <TouchableOpacity
                style={styles.clearSearch}
                onPress={() => {
                  setSearchQuery('');
                  setFilterApplied(false);
                  setCurrentPage(0);
                }}
              >
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setFormMode('add');
              setModalVisible(true);
            }}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Yeni Kullanıcı Ekle</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Kullanıcılar yükleniyor...</Text>
        </View>
      ) : (
        <>
          <View style={styles.tableContainer}>
            {renderTableHeader()}
            
            {users.length === 0 ? (
              <View style={styles.noDataContainer}>
                <Ionicons name="information-circle-outline" size={50} color="#888" />
                <Text style={styles.noDataText}>
                  {filterApplied 
                    ? "Aranan kriterlere uygun kullanıcı bulunamadı." 
                    : "Henüz kullanıcı eklenmemiş."}
                </Text>
                {filterApplied && (
                  <TouchableOpacity
                    style={styles.clearFilterButton}
                    onPress={() => {
                      setSearchQuery('');
                      setFilterApplied(false);
                    }}
                  >
                    <Text style={styles.clearFilterButtonText}>Filtreyi Temizle</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={users}
                keyExtractor={(item) => item.id}
                renderItem={renderUserItem}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={["#1e3a8a"]}
                    tintColor="#1e3a8a"
                  />
                }
              />
            )}
          </View>
          
          {/* Sayfalama Kontrolleri */}
          {users.length > 0 && renderPaginationControls()}
        </>
      )}

      {/* Kullanıcı Ekleme/Düzenleme Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {formMode === 'add' ? 'Yeni Kullanıcı Ekle' : 'Kullanıcı Düzenle'}
            </Text>
            
            <ScrollView style={styles.formContainer}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>E-posta</Text>
                <TextInput
                  style={[styles.formInput, formMode === 'edit' && styles.disabledInput]}
                  value={formData.email}
                  onChangeText={(text) => setFormData({...formData, email: text})}
                  placeholder="E-posta adresini girin"
                  keyboardType="email-address"
                  editable={formMode !== 'edit'} // Düzenleme modunda e-posta değiştirilemez
                />
              </View>
              
              {formMode === 'add' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Şifre</Text>
                    <TextInput
                      style={styles.formInput}
                      value={passwordData.password}
                      onChangeText={(text) => setPasswordData({...passwordData, password: text})}
                      placeholder="Şifre girin"
                      secureTextEntry
                    />
                  </View>
                  
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Şifre Tekrar</Text>
                    <TextInput
                      style={styles.formInput}
                      value={passwordData.confirmPassword}
                      onChangeText={(text) => setPasswordData({...passwordData, confirmPassword: text})}
                      placeholder="Şifreyi tekrar girin"
                      secureTextEntry
                    />
                  </View>
                </>
              )}
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Ad</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.first_name}
                  onChangeText={(text) => setFormData({...formData, first_name: text})}
                  placeholder="Adını girin"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Soyad</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.last_name}
                  onChangeText={(text) => setFormData({...formData, last_name: text})}
                  placeholder="Soyadını girin"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Telefon</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({...formData, phone: text})}
                  placeholder="Telefon numarasını girin"
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Yetki</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity 
                    style={[
                      styles.radioButton, 
                      formData.role === 'user' && styles.radioButtonSelected
                    ]}
                    onPress={() => setFormData({...formData, role: 'user'})}
                  >
                    <View style={[
                      styles.radioCircle, 
                      formData.role === 'user' && styles.radioCircleSelected
                    ]} />
                    <Text style={styles.radioLabel}>Kullanıcı</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.radioButton, 
                      formData.role === 'manager' && styles.radioButtonSelected
                    ]}
                    onPress={() => setFormData({...formData, role: 'manager'})}
                  >
                    <View style={[
                      styles.radioCircle, 
                      formData.role === 'manager' && styles.radioCircleSelected
                    ]} />
                    <Text style={styles.radioLabel}>Müdür</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.radioButton, 
                      formData.role === 'admin' && styles.radioButtonSelected
                    ]}
                    onPress={() => setFormData({...formData, role: 'admin'})}
                  >
                    <View style={[
                      styles.radioCircle, 
                      formData.role === 'admin' && styles.radioCircleSelected
                    ]} />
                    <Text style={styles.radioLabel}>Yönetici</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Durum</Text>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>{formData.is_active ? 'Aktif' : 'Pasif'}</Text>
                  <Switch
                    value={formData.is_active}
                    onValueChange={(value) => setFormData({...formData, is_active: value})}
                    trackColor={{ false: "#767577", true: "#1e3a8a" }}
                    thumbColor={formData.is_active ? "#fff" : "#f4f3f4"}
                  />
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveUser}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginRight: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#333',
  },
  clearSearch: {
    padding: 5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  tableContainer: {
    flex: 1,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  tableHeaderCell: {
    flex: 1,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    color: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
  },
  cellText: {
    color: '#333',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  editButton: {
    backgroundColor: '#4c6ef5',
  },
  activateButton: {
    backgroundColor: '#4caf50',
  },
  deactivateButton: {
    backgroundColor: '#f44336',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  noDataText: {
    marginTop: 10,
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  clearFilterButton: {
    marginTop: 15,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  clearFilterButtonText: {
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: Platform.OS === 'web' ? '60%' : '90%',
    maxWidth: 500,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  formContainer: {
    maxHeight: 400,
  },
  formGroup: {
    marginBottom: 15,
  },
  formLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#888',
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  radioButtonSelected: {
    borderColor: '#1e3a8a',
    backgroundColor: '#f0f4ff',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#777',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#1e3a8a',
    borderWidth: 6,
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#1e3a8a',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    margin: 10,
  },
  paginationInfo: {
    flex: 1,
  },
  paginationText: {
    color: '#fff',
    fontSize: 14,
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  pageButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  pageIndicator: {
    paddingHorizontal: 15,
  },
  pageIndicatorText: {
    color: '#fff',
    fontSize: 14,
  },
  pageSizeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  pageSizeLabel: {
    color: '#fff',
    marginRight: 10,
  },
  pageSizeButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginLeft: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
  },
  activePageSizeButton: {
    backgroundColor: '#fff',
  },
  pageSizeButtonText: {
    color: '#fff',
  },
  activePageSizeButtonText: {
    color: '#1e3a8a',
    fontWeight: 'bold',
  },
});

export default UsersScreen; 